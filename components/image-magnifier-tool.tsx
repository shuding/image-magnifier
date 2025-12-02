"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, Download, Copy, Trash2, Check, Menu, X, Circle, Square, Sun, Moon } from "lucide-react"

interface Magnifier {
  id: string
  x: number
  y: number
  radius: number
  width: number
  height: number
  zoom: number
  shape: "circle" | "rectangle"
}

export function ImageMagnifierTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [magnifiers, setMagnifiers] = useState<Magnifier[]>([])
  const [selectedMagnifier, setSelectedMagnifier] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [copied, setCopied] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 })
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [darkBorder, setDarkBorder] = useState(false)
  const [dragState, setDragState] = useState<{
    x: number
    y: number
    initialX: number
    initialY: number
    initialWidth: number
    initialHeight: number
    initialRadius: number
    shape: "circle" | "rectangle"
  } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedMagnifier) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault()
        setMagnifiers((prev) => prev.filter((mag) => mag.id !== selectedMagnifier))
        setSelectedMagnifier(null)
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
  }, [selectedMagnifier])

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
      if (mag.shape === "rectangle") {
        const halfWidth = mag.width / 2
        const halfHeight = mag.height / 2
        ctx.roundRect(mag.x - halfWidth, mag.y - halfHeight, mag.width, mag.height, 8)
      } else {
        ctx.arc(mag.x, mag.y, mag.radius, 0, Math.PI * 2)
      }
      ctx.clip()

      const scaleX = image.naturalWidth / canvasDisplaySize.width
      const scaleY = image.naturalHeight / canvasDisplaySize.height
      const sourceX = mag.x * scaleX
      const sourceY = mag.y * scaleY

      if (mag.shape === "rectangle") {
        const zoomWidth = mag.width / 2 / mag.zoom
        const zoomHeight = mag.height / 2 / mag.zoom
        ctx.drawImage(
          image,
          sourceX - zoomWidth * scaleX,
          sourceY - zoomHeight * scaleY,
          zoomWidth * 2 * scaleX,
          zoomHeight * 2 * scaleY,
          mag.x - mag.width / 2,
          mag.y - mag.height / 2,
          mag.width,
          mag.height,
        )
      } else {
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
      }

      ctx.restore()

      ctx.save()
      ctx.beginPath()
      if (mag.shape === "rectangle") {
        const halfWidth = mag.width / 2
        const halfHeight = mag.height / 2
        ctx.roundRect(mag.x - halfWidth, mag.y - halfHeight, mag.width, mag.height, 8)
      } else {
        ctx.arc(mag.x, mag.y, mag.radius, 0, Math.PI * 2)
      }
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
      ctx.shadowBlur = 15
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4
      ctx.strokeStyle =
        selectedMagnifier === mag.id ? "#3b82f6" : darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = selectedMagnifier === mag.id ? 3 : 2
      ctx.stroke()
      ctx.restore()

      ctx.beginPath()
      if (mag.shape === "rectangle") {
        const halfWidth = mag.width / 2 + 1
        const halfHeight = mag.height / 2 + 1
        ctx.roundRect(mag.x - halfWidth, mag.y - halfHeight, halfWidth * 2, halfHeight * 2, 8)
      } else {
        ctx.arc(mag.x, mag.y, mag.radius + 1, 0, Math.PI * 2)
      }
      ctx.strokeStyle = darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
      ctx.lineWidth = 1
      ctx.stroke()

      if (selectedMagnifier === mag.id) {
        let handleX: number, handleY: number
        if (mag.shape === "rectangle") {
          handleX = mag.x + mag.width / 2
          handleY = mag.y + mag.height / 2
        } else {
          handleX = mag.x + mag.radius * Math.cos(Math.PI / 4)
          handleY = mag.y + mag.radius * Math.sin(Math.PI / 4)
        }
        ctx.beginPath()
        ctx.arc(handleX, handleY, 8, 0, Math.PI * 2)
        ctx.fillStyle = "#3b82f6"
        ctx.fill()
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })
  }, [image, magnifiers, selectedMagnifier, canvasDisplaySize, darkBorder])

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

  const addMagnifier = (shape: "circle" | "rectangle" = "circle") => {
    if (!canvasDisplaySize.width) return
    const newMagnifier: Magnifier = {
      id: Date.now().toString(),
      x: canvasDisplaySize.width / 2,
      y: canvasDisplaySize.height / 2,
      radius: 60,
      width: 120,
      height: 120,
      zoom: 2,
      shape,
    }
    setMagnifiers([...magnifiers, newMagnifier])
    setSelectedMagnifier(newMagnifier.id)
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
    let handleX: number, handleY: number
    if (mag.shape === "rectangle") {
      handleX = mag.x + mag.width / 2
      handleY = mag.y + mag.height / 2
    } else {
      handleX = mag.x + mag.radius * Math.cos(Math.PI / 4)
      handleY = mag.y + mag.radius * Math.sin(Math.PI / 4)
    }
    const dist = Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2)
    return dist <= 12
  }

  const isInsideMagnifier = (x: number, y: number, mag: Magnifier) => {
    if (mag.shape === "rectangle") {
      const halfWidth = mag.width / 2
      const halfHeight = mag.height / 2
      return x >= mag.x - halfWidth && x <= mag.x + halfWidth && y >= mag.y - halfHeight && y <= mag.y + halfHeight
    }
    const dist = Math.sqrt((x - mag.x) ** 2 + (y - mag.y) ** 2)
    return dist <= mag.radius
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e)

    if (selectedMagnifier) {
      const selected = magnifiers.find((m) => m.id === selectedMagnifier)
      if (selected && isOnResizeHandle(x, y, selected)) {
        setIsResizing(true)
        setDragState({
          x,
          y,
          initialX: selected.x,
          initialY: selected.y,
          initialWidth: selected.width,
          initialHeight: selected.height,
          initialRadius: selected.radius,
          shape: selected.shape,
        })
        return
      }
    }

    for (let i = magnifiers.length - 1; i >= 0; i--) {
      const mag = magnifiers[i]
      if (isInsideMagnifier(x, y, mag)) {
        setSelectedMagnifier(mag.id)
        setIsDragging(true)
        setDragOffset({ x: x - mag.x, y: y - mag.y })
        setDragState({
          x,
          y,
          initialX: mag.x,
          initialY: mag.y,
          initialWidth: mag.width,
          initialHeight: mag.height,
          initialRadius: mag.radius,
          shape: mag.shape,
        })
        return
      }
    }

    setSelectedMagnifier(null)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const { x, y } = getTouchCoords(e)

    if (selectedMagnifier) {
      const selected = magnifiers.find((m) => m.id === selectedMagnifier)
      if (selected && isOnResizeHandle(x, y, selected)) {
        setIsResizing(true)
        setDragState({
          x,
          y,
          initialX: selected.x,
          initialY: selected.y,
          initialWidth: selected.width,
          initialHeight: selected.height,
          initialRadius: selected.radius,
          shape: selected.shape,
        })
        e.preventDefault()
        return
      }
    }

    for (let i = magnifiers.length - 1; i >= 0; i--) {
      const mag = magnifiers[i]
      if (isInsideMagnifier(x, y, mag)) {
        setSelectedMagnifier(mag.id)
        setIsDragging(true)
        setDragOffset({ x: x - mag.x, y: y - mag.y })
        setDragState({
          x,
          y,
          initialX: mag.x,
          initialY: mag.y,
          initialWidth: mag.width,
          initialHeight: mag.height,
          initialRadius: mag.radius,
          shape: mag.shape,
        })
        e.preventDefault()
        return
      }
    }

    setSelectedMagnifier(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e)

    if (isDragging && selectedMagnifier) {
      setMagnifiers((prev) =>
        prev.map((mag) => (mag.id === selectedMagnifier ? { ...mag, x: x - dragOffset.x, y: y - dragOffset.y } : mag)),
      )
    }

    if (isResizing && selectedMagnifier && dragState) {
      setMagnifiers((prev) =>
        prev.map((mag) => {
          if (mag.id === selectedMagnifier) {
            if (mag.shape === "rectangle") {
              const newWidth = Math.max(60, Math.min(400, (x - dragState.initialX) * 2))
              const newHeight = Math.max(60, Math.min(400, (y - dragState.initialY) * 2))
              return { ...mag, width: newWidth, height: newHeight }
            } else {
              const dist = Math.sqrt((x - dragState.initialX) ** 2 + (y - dragState.initialY) ** 2)
              return { ...mag, radius: Math.max(30, Math.min(200, dist)) }
            }
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
      for (const mag of magnifiers) {
        if (isInsideMagnifier(x, y, mag)) {
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

    if (isResizing && selectedMagnifier && dragState) {
      e.preventDefault()
      setMagnifiers((prev) =>
        prev.map((mag) => {
          if (mag.id === selectedMagnifier) {
            if (mag.shape === "rectangle") {
              const newWidth = Math.max(60, Math.min(400, (x - dragState.initialX) * 2))
              const newHeight = Math.max(60, Math.min(400, (y - dragState.initialY) * 2))
              return { ...mag, width: newWidth, height: newHeight }
            } else {
              const dist = Math.sqrt((x - dragState.initialX) ** 2 + (y - dragState.initialY) ** 2)
              return { ...mag, radius: Math.max(30, Math.min(200, dist)) }
            }
          }
          return mag
        }),
      )
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setDragState(null)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setIsResizing(false)
    setDragState(null)
  }

  const updateSelectedZoom = (zoom: number) => {
    if (!selectedMagnifier) return
    setMagnifiers((prev) => prev.map((mag) => (mag.id === selectedMagnifier ? { ...mag, zoom } : mag)))
  }

  const deleteSelected = () => {
    if (!selectedMagnifier) return
    setMagnifiers((prev) => prev.filter((mag) => mag.id !== selectedMagnifier))
    setSelectedMagnifier(null)
  }

  const updateSelectedShape = (shape: "circle" | "rectangle") => {
    if (!selectedMagnifier) return
    setMagnifiers((prev) =>
      prev.map((mag) => {
        if (mag.id === selectedMagnifier) {
          if (shape === "rectangle") {
            return { ...mag, shape, width: mag.radius * 2, height: mag.radius * 2 }
          } else {
            return { ...mag, shape, radius: Math.max(mag.width, mag.height) / 2 }
          }
        }
        return mag
      }),
    )
  }

  const downloadImage = useCallback(async () => {
    if (!image) return

    const dpr = 2
    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = image.naturalWidth * dpr
    exportCanvas.height = image.naturalHeight * dpr
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)

    const scaleX = image.naturalWidth / canvasDisplaySize.width
    const scaleY = image.naturalHeight / canvasDisplaySize.height

    magnifiers.forEach((mag) => {
      const scaledX = mag.x * scaleX
      const scaledY = mag.y * scaleY
      const scaledRadius = mag.radius * Math.min(scaleX, scaleY)
      const scaledWidth = mag.width * scaleX
      const scaledHeight = mag.height * scaleY

      ctx.save()
      ctx.beginPath()
      if (mag.shape === "rectangle") {
        const halfWidth = scaledWidth / 2
        const halfHeight = scaledHeight / 2
        ctx.roundRect(
          scaledX - halfWidth,
          scaledY - halfHeight,
          scaledWidth,
          scaledHeight,
          8 * Math.min(scaleX, scaleY),
        )
      } else {
        ctx.arc(scaledX, scaledY, scaledRadius, 0, Math.PI * 2)
      }
      ctx.clip()

      if (mag.shape === "rectangle") {
        const zoomWidth = scaledWidth / 2 / mag.zoom
        const zoomHeight = scaledHeight / 2 / mag.zoom
        ctx.drawImage(
          image,
          scaledX - zoomWidth,
          scaledY - zoomHeight,
          zoomWidth * 2,
          zoomHeight * 2,
          scaledX - scaledWidth / 2,
          scaledY - scaledHeight / 2,
          scaledWidth,
          scaledHeight,
        )
      } else {
        const zoomRadius = scaledRadius / mag.zoom
        ctx.drawImage(
          image,
          scaledX - zoomRadius,
          scaledY - zoomRadius,
          zoomRadius * 2,
          zoomRadius * 2,
          scaledX - scaledRadius,
          scaledY - scaledRadius,
          scaledRadius * 2,
          scaledRadius * 2,
        )
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      if (mag.shape === "rectangle") {
        const halfWidth = scaledWidth / 2
        const halfHeight = scaledHeight / 2
        ctx.roundRect(
          scaledX - halfWidth,
          scaledY - halfHeight,
          scaledWidth,
          scaledHeight,
          8 * Math.min(scaleX, scaleY),
        )
      } else {
        ctx.arc(scaledX, scaledY, scaledRadius, 0, Math.PI * 2)
      }
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
      ctx.shadowBlur = 15 * Math.min(scaleX, scaleY)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4 * Math.min(scaleX, scaleY)
      ctx.strokeStyle = darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = 2 * Math.min(scaleX, scaleY)
      ctx.stroke()
      ctx.restore()

      ctx.beginPath()
      if (mag.shape === "rectangle") {
        const halfWidth = scaledWidth / 2 + 1
        const halfHeight = scaledHeight / 2 + 1
        ctx.roundRect(
          scaledX - halfWidth,
          scaledY - halfHeight,
          halfWidth * 2,
          halfHeight * 2,
          8 * Math.min(scaleX, scaleY),
        )
      } else {
        ctx.arc(scaledX, scaledY, scaledRadius + 1, 0, Math.PI * 2)
      }
      ctx.strokeStyle = darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
      ctx.lineWidth = 1
      ctx.stroke()
    })

    const link = document.createElement("a")
    link.download = "magnified-image.png"
    link.href = exportCanvas.toDataURL("image/png")
    link.click()
  }, [image, magnifiers, canvasDisplaySize, darkBorder])

  const copyImage = useCallback(async () => {
    if (!image) return

    const dpr = 2
    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = image.naturalWidth * dpr
    exportCanvas.height = image.naturalHeight * dpr
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)

    const scaleX = image.naturalWidth / canvasDisplaySize.width
    const scaleY = image.naturalHeight / canvasDisplaySize.height

    magnifiers.forEach((mag) => {
      const scaledX = mag.x * scaleX
      const scaledY = mag.y * scaleY
      const scaledRadius = mag.radius * Math.min(scaleX, scaleY)
      const scaledWidth = mag.width * scaleX
      const scaledHeight = mag.height * scaleY

      ctx.save()
      ctx.beginPath()
      if (mag.shape === "rectangle") {
        const halfWidth = scaledWidth / 2
        const halfHeight = scaledHeight / 2
        ctx.roundRect(
          scaledX - halfWidth,
          scaledY - halfHeight,
          scaledWidth,
          scaledHeight,
          8 * Math.min(scaleX, scaleY),
        )
      } else {
        ctx.arc(scaledX, scaledY, scaledRadius, 0, Math.PI * 2)
      }
      ctx.clip()

      if (mag.shape === "rectangle") {
        const zoomWidth = scaledWidth / 2 / mag.zoom
        const zoomHeight = scaledHeight / 2 / mag.zoom
        ctx.drawImage(
          image,
          scaledX - zoomWidth,
          scaledY - zoomHeight,
          zoomWidth * 2,
          zoomHeight * 2,
          scaledX - scaledWidth / 2,
          scaledY - scaledHeight / 2,
          scaledWidth,
          scaledHeight,
        )
      } else {
        const zoomRadius = scaledRadius / mag.zoom
        ctx.drawImage(
          image,
          scaledX - zoomRadius,
          scaledY - zoomRadius,
          zoomRadius * 2,
          zoomRadius * 2,
          scaledX - scaledRadius,
          scaledY - scaledRadius,
          scaledRadius * 2,
          scaledRadius * 2,
        )
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      if (mag.shape === "rectangle") {
        const halfWidth = scaledWidth / 2
        const halfHeight = scaledHeight / 2
        ctx.roundRect(
          scaledX - halfWidth,
          scaledY - halfHeight,
          scaledWidth,
          scaledHeight,
          8 * Math.min(scaleX, scaleY),
        )
      } else {
        ctx.arc(scaledX, scaledY, scaledRadius, 0, Math.PI * 2)
      }
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
      ctx.shadowBlur = 15 * Math.min(scaleX, scaleY)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4 * Math.min(scaleX, scaleY)
      ctx.strokeStyle = darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = 2 * Math.min(scaleX, scaleY)
      ctx.stroke()
      ctx.restore()

      ctx.beginPath()
      if (mag.shape === "rectangle") {
        const halfWidth = scaledWidth / 2 + 1
        const halfHeight = scaledHeight / 2 + 1
        ctx.roundRect(
          scaledX - halfWidth,
          scaledY - halfHeight,
          halfWidth * 2,
          halfHeight * 2,
          8 * Math.min(scaleX, scaleY),
        )
      } else {
        ctx.arc(scaledX, scaledY, scaledRadius + 1, 0, Math.PI * 2)
      }
      ctx.strokeStyle = darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
      ctx.lineWidth = 1
      ctx.stroke()
    })

    exportCanvas.toBlob(async (blob) => {
      if (!blob) return
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Clipboard write failed silently
      }
    }, "image/png")
  }, [image, magnifiers, canvasDisplaySize, darkBorder])

  const selectedMag = magnifiers.find((m) => m.id === selectedMagnifier)

  const getMagnifierScreenPosition = (mag: Magnifier) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, radius: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / canvasDisplaySize.width
    const scaleY = rect.height / canvasDisplaySize.height
    return {
      x: mag.x * scaleX,
      y: mag.y * scaleY,
      radius:
        mag.shape === "rectangle"
          ? (Math.max(mag.width, mag.height) / 2) * Math.min(scaleX, scaleY)
          : mag.radius * Math.min(scaleX, scaleY),
    }
  }

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
              <Button onClick={() => addMagnifier("circle")} size="sm" className="flex-1 gap-1.5 h-8 text-xs">
                <Circle className="h-3.5 w-3.5" />
                Circle
              </Button>
              <Button onClick={() => addMagnifier("rectangle")} size="sm" className="flex-1 gap-1.5 h-8 text-xs">
                <Square className="h-3.5 w-3.5" />
                Rectangle
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
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => updateSelectedShape("circle")}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-7 text-xs rounded-md transition-colors ${
                      selectedMag.shape === "circle"
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    <Circle className="h-3 w-3" />
                    Circle
                  </button>
                  <button
                    onClick={() => updateSelectedShape("rectangle")}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-7 text-xs rounded-md transition-colors ${
                      selectedMag.shape === "rectangle"
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    <Square className="h-3 w-3" />
                    Rectangle
                  </button>
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
                Click magnifier to select. Drag to move. Drag handle to resize. Press Delete to remove.
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
                    top: `${pos.y + (selectedMag.shape === "rectangle" ? selectedMag.height / 2 : pos.radius) + 8}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div
                    className="bg-white/70 backdrop-blur-sm rounded-full p-1.5 flex items-center gap-1.5 pr-2 pt-1.5"
                    style={{
                      width: "180px",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <button
                      onClick={() => setDarkBorder(!darkBorder)}
                      className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-neutral-200 transition-colors"
                      title={darkBorder ? "Switch to light border" : "Switch to dark border"}
                    >
                      {darkBorder ? (
                        <Moon className="h-3 w-3 text-neutral-600" />
                      ) : (
                        <Sun className="h-3 w-3 text-neutral-500" />
                      )}
                    </button>
                    <div className="w-px h-3 bg-neutral-200 ml-0 mr-1" />
                    <Slider
                      value={[selectedMag.zoom]}
                      onValueChange={([v]) => updateSelectedZoom(v)}
                      min={1}
                      max={5}
                      step={0.1}
                      className="flex-1 h-1 w-16"
                    />
                    <span className="text-[10px] font-medium text-neutral-500 w-6 text-right tabular-nums">
                      {selectedMag.zoom.toFixed(1)}x
                    </span>
                  </div>
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
