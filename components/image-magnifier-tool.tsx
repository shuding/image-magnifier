"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, Plus, Download, Copy, Trash2, Check, Menu, X, Type } from "lucide-react"

interface Magnifier {
  id: string
  x: number
  y: number
  radius: number
  zoom: number
}

interface TextAnnotation {
  id: string
  x: number
  y: number
  text: string
  fontSize: number
  color: string
}

export function ImageMagnifierTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [magnifiers, setMagnifiers] = useState<Magnifier[]>([])
  const [selectedMagnifier, setSelectedMagnifier] = useState<string | null>(null)
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([])
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isDraggingText, setIsDraggingText] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [copied, setCopied] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 })
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && (selectedMagnifier || selectedText)) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault()
        if (selectedMagnifier) {
          setMagnifiers((prev) => prev.filter((mag) => mag.id !== selectedMagnifier))
          setSelectedMagnifier(null)
        }
        if (selectedText) {
          setTextAnnotations((prev) => prev.filter((t) => t.id !== selectedText))
          setSelectedText(null)
        }
      }
    }

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            handleImageUpload(file)
          }
          return
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("paste", handlePaste)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("paste", handlePaste)
    }
  }, [selectedMagnifier, selectedText])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !image || canvasDisplaySize.width === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasDisplaySize.width, canvasDisplaySize.height)
    ctx.drawImage(image, 0, 0, canvasDisplaySize.width, canvasDisplaySize.height)

    magnifiers.forEach((mag) => {
      ctx.save()

      ctx.beginPath()
      ctx.arc(mag.x, mag.y, mag.radius, 0, Math.PI * 2)
      ctx.clip()

      const scaleX = image.naturalWidth / canvasDisplaySize.width
      const scaleY = image.naturalHeight / canvasDisplaySize.height
      const sourceX = mag.x * scaleX
      const sourceY = mag.y * scaleY

      const zoomRadius = mag.radius / mag.zoom
      ctx.drawImage(
        image,
        sourceX - zoomRadius * scaleX,
        sourceY - zoomRadius * scaleY,
        zoomRadius * 2 * scaleX,
        zoomRadius * 2 * scaleY,
        mag.x - mag.radius,
        mag.y - mag.radius,
        mag.radius * 2,
        mag.radius * 2,
      )

      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.arc(mag.x, mag.y, mag.radius, 0, Math.PI * 2)
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
      ctx.shadowBlur = 15
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4
      ctx.strokeStyle = selectedMagnifier === mag.id ? "#3b82f6" : "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = selectedMagnifier === mag.id ? 3 : 2
      ctx.stroke()
      ctx.restore()

      ctx.beginPath()
      ctx.arc(mag.x, mag.y, mag.radius + 1, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"
      ctx.lineWidth = 1
      ctx.stroke()

      if (selectedMagnifier === mag.id) {
        const handleX = mag.x + mag.radius * Math.cos(Math.PI / 4)
        const handleY = mag.y + mag.radius * Math.sin(Math.PI / 4)
        ctx.beginPath()
        ctx.arc(handleX, handleY, 8, 0, Math.PI * 2)
        ctx.fillStyle = "#3b82f6"
        ctx.fill()
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    textAnnotations.forEach((textAnn) => {
      if (editingTextId === textAnn.id) return // Don't draw text being edited

      ctx.save()
      ctx.font = `600 ${textAnn.fontSize}px "Geist", system-ui, sans-serif`
      ctx.fillStyle = textAnn.color
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1

      // Draw each line of text
      const lines = textAnn.text.split("\n")
      lines.forEach((line, index) => {
        ctx.fillText(line, textAnn.x, textAnn.y + index * (textAnn.fontSize * 1.2))
      })

      // Draw selection indicator
      if (selectedText === textAnn.id) {
        const metrics = ctx.measureText(textAnn.text)
        const textHeight = textAnn.fontSize * lines.length * 1.2
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.strokeRect(textAnn.x - 4, textAnn.y - textAnn.fontSize, metrics.width + 8, textHeight + 8)
      }
      ctx.restore()
    })
  }, [image, magnifiers, selectedMagnifier, canvasDisplaySize, textAnnotations, selectedText, editingTextId])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  useEffect(() => {
    if (!image) return

    const setupCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const isMobile = window.innerWidth < 768
      const maxWidth = isMobile ? window.innerWidth - 32 : 900
      const maxHeight = isMobile ? window.innerHeight - 120 : 600

      const aspectRatio = image.naturalWidth / image.naturalHeight

      let displayWidth: number
      let displayHeight: number

      if (image.naturalWidth / maxWidth > image.naturalHeight / maxHeight) {
        displayWidth = Math.min(maxWidth, image.naturalWidth)
        displayHeight = displayWidth / aspectRatio
      } else {
        displayHeight = Math.min(maxHeight, image.naturalHeight)
        displayWidth = displayHeight * aspectRatio
      }

      const dpr = window.devicePixelRatio || 1
      canvas.width = displayWidth * dpr
      canvas.height = displayHeight * dpr
      canvas.style.width = `${displayWidth}px`
      canvas.style.height = `${displayHeight}px`

      setCanvasDisplaySize({ width: displayWidth, height: displayHeight })
    }

    requestAnimationFrame(setupCanvas)
  }, [image])

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        setMagnifiers([])
        setSelectedMagnifier(null)
        setTextAnnotations([])
        setSelectedText(null)
        setCanvasDisplaySize({ width: 0, height: 0 })
        setImage(img)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
      e.target.value = ""
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const addMagnifier = () => {
    if (!canvasDisplaySize.width) return
    const newMagnifier: Magnifier = {
      id: Date.now().toString(),
      x: canvasDisplaySize.width / 2,
      y: canvasDisplaySize.height / 2,
      radius: 60,
      zoom: 2,
    }
    setMagnifiers([...magnifiers, newMagnifier])
    setSelectedMagnifier(newMagnifier.id)
    setSelectedText(null)
  }

  const addTextAnnotation = () => {
    if (!canvasDisplaySize.width) return
    const newText: TextAnnotation = {
      id: Date.now().toString(),
      x: canvasDisplaySize.width / 2 - 50,
      y: canvasDisplaySize.height / 2,
      text: "Text",
      fontSize: 24,
      color: "#ffffff",
    }
    setTextAnnotations([...textAnnotations, newText])
    setSelectedText(newText.id)
    setSelectedMagnifier(null)
    setEditingTextId(newText.id)
  }

  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvasDisplaySize.width / rect.width
    const scaleY = canvasDisplaySize.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const getTouchCoords = (e: React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0] || e.changedTouches[0]
    const scaleX = canvasDisplaySize.width / rect.width
    const scaleY = canvasDisplaySize.height / rect.height
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    }
  }

  const isOnResizeHandle = (x: number, y: number, mag: Magnifier) => {
    const handleX = mag.x + mag.radius * Math.cos(Math.PI / 4)
    const handleY = mag.y + mag.radius * Math.sin(Math.PI / 4)
    const dist = Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2)
    return dist <= 12
  }

  const isOnTextAnnotation = (x: number, y: number, textAnn: TextAnnotation) => {
    const canvas = canvasRef.current
    if (!canvas) return false
    const ctx = canvas.getContext("2d")
    if (!ctx) return false

    ctx.font = `600 ${textAnn.fontSize}px "Geist", system-ui, sans-serif`
    const lines = textAnn.text.split("\n")
    const maxWidth = Math.max(...lines.map((line) => ctx.measureText(line).width))
    const textHeight = textAnn.fontSize * lines.length * 1.2

    return (
      x >= textAnn.x - 4 &&
      x <= textAnn.x + maxWidth + 4 &&
      y >= textAnn.y - textAnn.fontSize &&
      y <= textAnn.y + textHeight - textAnn.fontSize + 8
    )
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e)

    // Check for double-click on text to edit
    if (e.detail === 2) {
      for (let i = textAnnotations.length - 1; i >= 0; i--) {
        if (isOnTextAnnotation(x, y, textAnnotations[i])) {
          setEditingTextId(textAnnotations[i].id)
          setSelectedText(textAnnotations[i].id)
          setSelectedMagnifier(null)
          return
        }
      }
    }

    if (selectedMagnifier) {
      const selected = magnifiers.find((m) => m.id === selectedMagnifier)
      if (selected && isOnResizeHandle(x, y, selected)) {
        setIsResizing(true)
        return
      }
    }

    for (let i = textAnnotations.length - 1; i >= 0; i--) {
      if (isOnTextAnnotation(x, y, textAnnotations[i])) {
        setSelectedText(textAnnotations[i].id)
        setSelectedMagnifier(null)
        setIsDraggingText(true)
        setDragOffset({ x: x - textAnnotations[i].x, y: y - textAnnotations[i].y })
        return
      }
    }

    for (let i = magnifiers.length - 1; i >= 0; i--) {
      const mag = magnifiers[i]
      const dist = Math.sqrt((x - mag.x) ** 2 + (y - mag.y) ** 2)
      if (dist <= mag.radius) {
        setSelectedMagnifier(mag.id)
        setSelectedText(null)
        setIsDragging(true)
        setDragOffset({ x: x - mag.x, y: y - mag.y })
        return
      }
    }

    setSelectedMagnifier(null)
    setSelectedText(null)
    setEditingTextId(null)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const { x, y } = getTouchCoords(e)

    if (selectedMagnifier) {
      const selected = magnifiers.find((m) => m.id === selectedMagnifier)
      if (selected && isOnResizeHandle(x, y, selected)) {
        setIsResizing(true)
        e.preventDefault()
        return
      }
    }

    for (let i = textAnnotations.length - 1; i >= 0; i--) {
      if (isOnTextAnnotation(x, y, textAnnotations[i])) {
        setSelectedText(textAnnotations[i].id)
        setSelectedMagnifier(null)
        setIsDraggingText(true)
        setDragOffset({ x: x - textAnnotations[i].x, y: y - textAnnotations[i].y })
        e.preventDefault()
        return
      }
    }

    for (let i = magnifiers.length - 1; i >= 0; i--) {
      const mag = magnifiers[i]
      const dist = Math.sqrt((x - mag.x) ** 2 + (y - mag.y) ** 2)
      if (dist <= mag.radius) {
        setSelectedMagnifier(mag.id)
        setSelectedText(null)
        setIsDragging(true)
        setDragOffset({ x: x - mag.x, y: y - mag.y })
        e.preventDefault()
        return
      }
    }

    setSelectedMagnifier(null)
    setSelectedText(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e)

    if (isDragging && selectedMagnifier) {
      setMagnifiers((prev) =>
        prev.map((mag) => (mag.id === selectedMagnifier ? { ...mag, x: x - dragOffset.x, y: y - dragOffset.y } : mag)),
      )
    }

    if (isDraggingText && selectedText) {
      setTextAnnotations((prev) =>
        prev.map((t) => (t.id === selectedText ? { ...t, x: x - dragOffset.x, y: y - dragOffset.y } : t)),
      )
    }

    if (isResizing && selectedMagnifier) {
      setMagnifiers((prev) =>
        prev.map((mag) => {
          if (mag.id === selectedMagnifier) {
            const dist = Math.sqrt((x - mag.x) ** 2 + (y - mag.y) ** 2)
            return { ...mag, radius: Math.max(30, Math.min(200, dist)) }
          }
          return mag
        }),
      )
    }

    const canvas = canvasRef.current
    if (canvas) {
      let cursor = "default"
      if (selectedMagnifier) {
        const selected = magnifiers.find((m) => m.id === selectedMagnifier)
        if (selected && isOnResizeHandle(x, y, selected)) {
          cursor = "nwse-resize"
        }
      }
      for (const textAnn of textAnnotations) {
        if (isOnTextAnnotation(x, y, textAnn)) {
          cursor = "move"
          break
        }
      }
      for (const mag of magnifiers) {
        const dist = Math.sqrt((x - mag.x) ** 2 + (y - mag.y) ** 2)
        if (dist <= mag.radius) {
          cursor = "move"
          break
        }
      }
      canvas.style.cursor = cursor
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const { x, y } = getTouchCoords(e)

    if (isDragging && selectedMagnifier) {
      e.preventDefault()
      setMagnifiers((prev) =>
        prev.map((mag) => (mag.id === selectedMagnifier ? { ...mag, x: x - dragOffset.x, y: y - dragOffset.y } : mag)),
      )
    }

    if (isDraggingText && selectedText) {
      e.preventDefault()
      setTextAnnotations((prev) =>
        prev.map((t) => (t.id === selectedText ? { ...t, x: x - dragOffset.x, y: y - dragOffset.y } : t)),
      )
    }

    if (isResizing && selectedMagnifier) {
      e.preventDefault()
      setMagnifiers((prev) =>
        prev.map((mag) => {
          if (mag.id === selectedMagnifier) {
            const dist = Math.sqrt((x - mag.x) ** 2 + (y - mag.y) ** 2)
            return { ...mag, radius: Math.max(30, Math.min(200, dist)) }
          }
          return mag
        }),
      )
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setIsDraggingText(false)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setIsResizing(false)
    setIsDraggingText(false)
  }

  const updateSelectedZoom = (zoom: number) => {
    if (!selectedMagnifier) return
    setMagnifiers((prev) => prev.map((mag) => (mag.id === selectedMagnifier ? { ...mag, zoom } : mag)))
  }

  const updateSelectedTextFontSize = (fontSize: number) => {
    if (!selectedText) return
    setTextAnnotations((prev) => prev.map((t) => (t.id === selectedText ? { ...t, fontSize } : t)))
  }

  const updateSelectedTextColor = (color: string) => {
    if (!selectedText) return
    setTextAnnotations((prev) => prev.map((t) => (t.id === selectedText ? { ...t, color } : t)))
  }

  const updateSelectedTextContent = (text: string) => {
    if (!editingTextId) return
    setTextAnnotations((prev) => prev.map((t) => (t.id === editingTextId ? { ...t, text } : t)))
  }

  const deleteSelected = () => {
    if (selectedMagnifier) {
      setMagnifiers((prev) => prev.filter((mag) => mag.id !== selectedMagnifier))
      setSelectedMagnifier(null)
    }
    if (selectedText) {
      setTextAnnotations((prev) => prev.filter((t) => t.id !== selectedText))
      setSelectedText(null)
    }
  }

  const drawTextAnnotationsOnCanvas = (ctx: CanvasRenderingContext2D, scaleX: number, scaleY: number) => {
    textAnnotations.forEach((textAnn) => {
      ctx.save()
      const scaledFontSize = textAnn.fontSize * Math.min(scaleX, scaleY)
      ctx.font = `600 ${scaledFontSize}px "Geist", system-ui, sans-serif`
      ctx.fillStyle = textAnn.color
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = 4 * Math.min(scaleX, scaleY)
      ctx.shadowOffsetX = 1 * Math.min(scaleX, scaleY)
      ctx.shadowOffsetY = 1 * Math.min(scaleX, scaleY)

      const lines = textAnn.text.split("\n")
      lines.forEach((line, index) => {
        ctx.fillText(line, textAnn.x * scaleX, textAnn.y * scaleY + index * (scaledFontSize * 1.2))
      })
      ctx.restore()
    })
  }

  const downloadImage = () => {
    if (!image) return

    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = image.naturalWidth
    tempCanvas.height = image.naturalHeight
    const ctx = tempCanvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height)

    const scaleX = image.naturalWidth / canvasDisplaySize.width
    const scaleY = image.naturalHeight / canvasDisplaySize.height

    magnifiers.forEach((mag) => {
      const scaledX = mag.x * scaleX
      const scaledY = mag.y * scaleY
      const scaledRadius = mag.radius * Math.min(scaleX, scaleY)

      ctx.save()
      ctx.beginPath()
      ctx.arc(scaledX, scaledY, scaledRadius, 0, Math.PI * 2)
      ctx.clip()

      const sourceX = scaledX
      const sourceY = scaledY
      const zoomRadius = scaledRadius / mag.zoom

      ctx.drawImage(
        image,
        sourceX - zoomRadius,
        sourceY - zoomRadius,
        zoomRadius * 2,
        zoomRadius * 2,
        scaledX - scaledRadius,
        scaledY - scaledRadius,
        scaledRadius * 2,
        scaledRadius * 2,
      )
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.arc(scaledX, scaledY, scaledRadius, 0, Math.PI * 2)
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
      ctx.shadowBlur = 15 * Math.min(scaleX, scaleY)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4 * Math.min(scaleX, scaleY)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = 2 * Math.min(scaleX, scaleY)
      ctx.stroke()
      ctx.restore()

      ctx.beginPath()
      ctx.arc(scaledX, scaledY, scaledRadius + 1, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"
      ctx.lineWidth = 1 * Math.min(scaleX, scaleY)
      ctx.stroke()
    })

    drawTextAnnotationsOnCanvas(ctx, scaleX, scaleY)

    const link = document.createElement("a")
    link.download = "magnified-image.png"
    link.href = tempCanvas.toDataURL("image/png")
    link.click()
  }

  const copyImage = async () => {
    if (!image) return

    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = image.naturalWidth
    tempCanvas.height = image.naturalHeight
    const ctx = tempCanvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height)

    const scaleX = image.naturalWidth / canvasDisplaySize.width
    const scaleY = image.naturalHeight / canvasDisplaySize.height

    magnifiers.forEach((mag) => {
      const scaledX = mag.x * scaleX
      const scaledY = mag.y * scaleY
      const scaledRadius = mag.radius * Math.min(scaleX, scaleY)

      ctx.save()
      ctx.beginPath()
      ctx.arc(scaledX, scaledY, scaledRadius, 0, Math.PI * 2)
      ctx.clip()

      const sourceX = scaledX
      const sourceY = scaledY
      const zoomRadius = scaledRadius / mag.zoom

      ctx.drawImage(
        image,
        sourceX - zoomRadius,
        sourceY - zoomRadius,
        zoomRadius * 2,
        zoomRadius * 2,
        scaledX - scaledRadius,
        scaledY - scaledRadius,
        scaledRadius * 2,
        scaledRadius * 2,
      )
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.arc(scaledX, scaledY, scaledRadius, 0, Math.PI * 2)
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
      ctx.shadowBlur = 15 * Math.min(scaleX, scaleY)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4 * Math.min(scaleX, scaleY)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = 2 * Math.min(scaleX, scaleY)
      ctx.stroke()
      ctx.restore()

      ctx.beginPath()
      ctx.arc(scaledX, scaledY, scaledRadius + 1, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"
      ctx.lineWidth = 1 * Math.min(scaleX, scaleY)
      ctx.stroke()
    })

    drawTextAnnotationsOnCanvas(ctx, scaleX, scaleY)

    try {
      const item = new ClipboardItem({
        "image/png": new Promise((resolve) => {
          tempCanvas.toBlob((blob) => {
            resolve(blob!)
          }, "image/png")
        }),
      })
      await navigator.clipboard.write([item])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy image:", err)
    }
  }

  const selectedMag = magnifiers.find((m) => m.id === selectedMagnifier)
  const selectedTextAnn = textAnnotations.find((t) => t.id === selectedText)
  const editingText = textAnnotations.find((t) => t.id === editingTextId)

  const getMagnifierScreenPosition = (mag: Magnifier) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, radius: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / canvasDisplaySize.width
    const scaleY = rect.height / canvasDisplaySize.height
    return {
      x: mag.x * scaleX,
      y: mag.y * scaleY,
      radius: mag.radius * Math.min(scaleX, scaleY),
    }
  }

  const getTextScreenPosition = (textAnn: TextAnnotation) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, fontSize: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / canvasDisplaySize.width
    const scaleY = rect.height / canvasDisplaySize.height
    return {
      x: textAnn.x * scaleX,
      y: textAnn.y * scaleY,
      fontSize: textAnn.fontSize * Math.min(scaleX, scaleY),
    }
  }

  const textColors = ["#ffffff", "#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"]

  return (
    <div
      className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 md:p-8"
      ref={containerRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {image && (
        <>
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="fixed top-4 right-4 z-[60] md:hidden bg-white rounded-full p-2.5 shadow-lg border border-neutral-200"
          >
            {isPanelOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div
            className={`fixed top-0 right-0 z-50 bg-white shadow-lg border-l md:border border-neutral-200 p-4 w-72 md:w-64 md:rounded-xl md:top-4 md:right-4 h-full md:h-auto transition-transform duration-300 ${
              isPanelOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
            }`}
          >
            <h1 className="text-sm font-semibold text-neutral-900 mb-3 mt-12 md:mt-0">Image Magnifier</h1>

            <div className="flex gap-2 mb-3">
              <Button onClick={addMagnifier} size="sm" className="flex-1 gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Magnify
              </Button>
              <Button
                onClick={addTextAnnotation}
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 h-8 text-xs bg-transparent"
              >
                <Type className="h-3.5 w-3.5" />
                Text
              </Button>
            </div>

            <Button
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="outline"
              className="w-full gap-1.5 h-8 text-xs mb-3"
            >
              <Upload className="h-3.5 w-3.5" />
              New Image
            </Button>

            {selectedMag && (
              <div className="border-t border-neutral-100 pt-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-500">Selected Magnifier</span>
                  <button
                    onClick={deleteSelected}
                    className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {selectedTextAnn && (
              <div className="border-t border-neutral-100 pt-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-500">Selected Text</span>
                  <button
                    onClick={deleteSelected}
                    className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-neutral-400 block mb-1.5">Font Size</span>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[selectedTextAnn.fontSize]}
                        onValueChange={([v]) => updateSelectedTextFontSize(v)}
                        min={12}
                        max={72}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-[10px] font-medium text-neutral-500 w-6 text-right tabular-nums">
                        {selectedTextAnn.fontSize}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 block mb-1.5">Color</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {textColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateSelectedTextColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            selectedTextAnn.color === color ? "border-blue-500 scale-110" : "border-neutral-200"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={() => setEditingTextId(selectedTextAnn.id)}
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs"
                  >
                    Edit Text
                  </Button>
                </div>
              </div>
            )}

            <div className="border-t border-neutral-100 pt-3">
              <div className="flex gap-2">
                <Button
                  onClick={downloadImage}
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 h-8 text-xs bg-transparent"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button
                  onClick={copyImage}
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 h-8 text-xs bg-transparent"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-neutral-100">
              <p className="text-[10px] text-neutral-400 leading-relaxed">
                Click magnifier or text to select. Drag to move. Double-click text to edit. Press Delete to remove.
              </p>
              <p className="text-[10px] text-neutral-400 mt-2">
                Created by{" "}
                <a
                  href="https://x.com/shuding_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
                >
                  Shu Ding
                </a>{" "}
                and{" "}
                <a
                  href="https://v0.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
                >
                  v0
                </a>
                .
              </p>
            </div>
          </div>

          {isPanelOpen && (
            <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setIsPanelOpen(false)} />
          )}
        </>
      )}

      {!image ? (
        <div className="flex flex-col items-center mx-4">
          <h1 className="text-2xl font-semibold text-neutral-800 mb-2">Image Magnifier</h1>
          <p className="text-sm text-neutral-500 mb-6">Add magnifying glass annotations to your images</p>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 md:p-16 text-center transition-all cursor-pointer max-w-lg w-full ${
              isDragOver ? "border-blue-400 bg-blue-50" : "border-neutral-300 hover:border-neutral-400 bg-white"
            }`}
          >
            <Upload className="mx-auto h-10 w-10 text-neutral-400 mb-4" />
            <p className="text-base font-medium text-neutral-700 mb-1">Drop an image here</p>
            <p className="text-sm text-neutral-400">or tap to browse</p>
          </div>
          <p className="text-xs text-neutral-400 mt-6">
            Created by{" "}
            <a
              href="https://x.com/shuding_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
            >
              Shu Ding
            </a>{" "}
            and{" "}
            <a
              href="https://v0.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
            >
              v0
            </a>
            .
          </p>
        </div>
      ) : (
        <div className={`relative transition-all ${isDragOver ? "ring-4 ring-blue-400 ring-offset-4 rounded-lg" : ""}`}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="block rounded-lg shadow-2xl touch-none"
            tabIndex={0}
          />

          {selectedMag &&
            canvasDisplaySize.width > 0 &&
            (() => {
              const pos = getMagnifierScreenPosition(selectedMag)
              return (
                <div
                  className="absolute pointer-events-auto z-10"
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y + pos.radius + 8}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div
                    className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2"
                    style={{
                      width: "120px",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <Slider
                      value={[selectedMag.zoom]}
                      onValueChange={([v]) => updateSelectedZoom(v)}
                      min={1}
                      max={5}
                      step={0.1}
                      className="flex-1 h-1"
                    />
                    <span className="text-[10px] font-medium text-neutral-500 w-6 text-right tabular-nums">
                      {selectedMag.zoom.toFixed(1)}x
                    </span>
                  </div>
                </div>
              )
            })()}

          {editingText &&
            canvasDisplaySize.width > 0 &&
            (() => {
              const pos = getTextScreenPosition(editingText)
              return (
                <div
                  className="absolute z-20"
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y - pos.fontSize}px`,
                  }}
                >
                  <textarea
                    ref={textInputRef}
                    autoFocus
                    value={editingText.text}
                    onChange={(e) => updateSelectedTextContent(e.target.value)}
                    onBlur={() => setEditingTextId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setEditingTextId(null)
                      }
                    }}
                    className="bg-transparent border-2 border-blue-500 rounded px-1 outline-none resize-none"
                    style={{
                      fontSize: `${pos.fontSize}px`,
                      fontWeight: 600,
                      color: editingText.color,
                      textShadow: "1px 1px 4px rgba(0, 0, 0, 0.5)",
                      minWidth: "100px",
                      lineHeight: 1.2,
                      fontFamily: '"Geist", system-ui, sans-serif',
                    }}
                    rows={editingText.text.split("\n").length}
                  />
                </div>
              )
            })()}

          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 rounded-lg">
              <span className="text-blue-600 font-medium text-sm bg-white px-3 py-1.5 rounded-full shadow">
                Drop to replace
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
