"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Upload, Download, Copy, Trash2, Check, Circle, Square, Sun, Moon, Plus } from "lucide-react"
import { Slider } from "@/components/ui/slider"

interface Magnifier {
  id: string
  x: number
  y: number
  radius: number
  width: number
  height: number
  zoom: number
  shape: "circle" | "rectangle"
  darkBorder: boolean
}

interface BlurRegion {
  id: string
  x: number
  y: number
  width: number
  height: number
  blurAmount: number
}

export function ImageMagnifierTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [magnifiers, setMagnifiers] = useState<Magnifier[]>([])
  const [blurRegions, setBlurRegions] = useState<BlurRegion[]>([])
  const [selectedMagnifier, setSelectedMagnifier] = useState<string | null>(null)
  const [selectedBlurRegion, setSelectedBlurRegion] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [copied, setCopied] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 })
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
  const [darkBorder, setDarkBorder] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedMagnifier) {
        e.preventDefault()
        setMagnifiers((prev) => prev.filter((m) => m.id !== selectedMagnifier))
        setSelectedMagnifier(null)
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBlurRegion) {
        e.preventDefault()
        setBlurRegions((prev) => prev.filter((b) => b.id !== selectedBlurRegion))
        setSelectedBlurRegion(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedMagnifier, selectedBlurRegion])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0)

    blurRegions.forEach((region) => {
      const halfWidth = region.width / 2
      const halfHeight = region.height / 2
      const x = region.x - halfWidth
      const y = region.y - halfHeight

      const tempCanvas = document.createElement("canvas")
      tempCanvas.width = region.width
      tempCanvas.height = region.height
      const tempCtx = tempCanvas.getContext("2d")
      if (!tempCtx) return

      tempCtx.drawImage(canvas, x, y, region.width, region.height, 0, 0, region.width, region.height)

      ctx.save()
      ctx.filter = `blur(${region.blurAmount}px)`
      ctx.drawImage(tempCanvas, x, y)
      ctx.restore()

      if (selectedBlurRegion === region.id) {
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x - 4, y - 4, region.width + 8, region.height + 8, 6)
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()

        const handleX = region.x + halfWidth + 4
        const handleY = region.y + halfHeight + 4
        ctx.beginPath()
        ctx.arc(handleX, handleY, 8, 0, Math.PI * 2)
        ctx.fillStyle = "#3b82f6"
        ctx.fill()
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

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
      ctx.strokeStyle = mag.darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = 2
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
      ctx.strokeStyle = mag.darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
      ctx.lineWidth = 1
      ctx.stroke()

      if (selectedMagnifier === mag.id) {
        ctx.save()
        ctx.beginPath()
        if (mag.shape === "rectangle") {
          const halfWidth = mag.width / 2 + 4
          const halfHeight = mag.height / 2 + 4
          ctx.roundRect(mag.x - halfWidth, mag.y - halfHeight, halfWidth * 2, halfHeight * 2, 10)
        } else {
          ctx.arc(mag.x, mag.y, mag.radius + 4, 0, Math.PI * 2)
        }
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()

        let handleX: number, handleY: number
        if (mag.shape === "rectangle") {
          handleX = mag.x + mag.width / 2 + 4
          handleY = mag.y + mag.height / 2 + 4
        } else {
          const outlineRadius = mag.radius + 4
          handleX = mag.x + outlineRadius * Math.cos(Math.PI / 4)
          handleY = mag.y + outlineRadius * Math.sin(Math.PI / 4)
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
  }, [image, magnifiers, blurRegions, selectedMagnifier, selectedBlurRegion, canvasDisplaySize])

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
        setBlurRegions([])
        setSelectedBlurRegion(null)
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
      darkBorder: darkBorder,
    }
    setMagnifiers([...magnifiers, newMagnifier])
    setSelectedMagnifier(newMagnifier.id)
    setSelectedBlurRegion(null)
  }

  const addBlurRegion = useCallback(() => {
    if (!image || !canvasRef.current) return

    const canvas = canvasRef.current
    const newRegion: BlurRegion = {
      id: Date.now().toString(),
      x: canvas.width / 2,
      y: canvas.height / 2,
      width: 150,
      height: 100,
      blurAmount: 10,
    }
    setBlurRegions((prev) => [...prev, newRegion])
    setSelectedBlurRegion(newRegion.id)
    setSelectedMagnifier(null)
  }, [image])

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

  const isOnResizeHandle = (x: number, y: number, mag: Magnifier | BlurRegion) => {
    let handleX: number, handleY: number
    if ("radius" in mag) {
      // It's a Magnifier
      if (mag.shape === "rectangle") {
        handleX = mag.x + mag.width / 2 + 4
        handleY = mag.y + mag.height / 2 + 4
      } else {
        const outlineRadius = mag.radius + 4
        handleX = mag.x + outlineRadius * Math.cos(Math.PI / 4)
        handleY = mag.y + outlineRadius * Math.sin(Math.PI / 4)
      }
    } else {
      // It's a BlurRegion
      handleX = mag.x + mag.width / 2 + 4
      handleY = mag.y + mag.height / 2 + 4
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !image) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Check if clicking on blur region resize handle
    for (const region of blurRegions) {
      if (selectedBlurRegion === region.id) {
        const handleX = region.x + region.width / 2 + 4
        const handleY = region.y + region.height / 2 + 4
        const handleDist = Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2))
        if (handleDist <= 12) {
          setIsResizing(true)
          setDragState({
            x: region.x,
            y: region.y,
            initialX: x,
            initialY: y,
            initialWidth: region.width,
            initialHeight: region.height,
            initialRadius: 0,
            shape: "rectangle",
          })
          return
        }
      }
    }

    // Check if clicking on a blur region
    for (const region of blurRegions) {
      const halfWidth = region.width / 2
      const halfHeight = region.height / 2
      if (
        x >= region.x - halfWidth &&
        x <= region.x + halfWidth &&
        y >= region.y - halfHeight &&
        y <= region.y + halfHeight
      ) {
        setSelectedBlurRegion(region.id)
        setSelectedMagnifier(null)
        setIsDragging(true)
        setDragOffset({ x: x - region.x, y: y - region.y })
        return
      }
    }

    for (let i = magnifiers.length - 1; i >= 0; i--) {
      const mag = magnifiers[i]
      if (isInsideMagnifier(x, y, mag)) {
        setSelectedMagnifier(mag.id)
        setSelectedBlurRegion(null) // Clear blur selection when clicking on magnifier
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

    // If no magnifier or blur region was clicked, deselect all
    setSelectedMagnifier(null)
    setSelectedBlurRegion(null)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const { x, y } = getTouchCoords(e)

    // Check if clicking on blur region resize handle
    for (const region of blurRegions) {
      if (selectedBlurRegion === region.id) {
        const handleX = region.x + region.width / 2 + 4
        const handleY = region.y + region.height / 2 + 4
        const handleDist = Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2))
        if (handleDist <= 12) {
          setIsResizing(true)
          setDragState({
            x: region.x,
            y: region.y,
            initialX: x,
            initialY: y,
            initialWidth: region.width,
            initialHeight: region.height,
            initialRadius: 0,
            shape: "rectangle",
          })
          e.preventDefault()
          return
        }
      }
    }

    // Check if clicking on a blur region
    for (const region of blurRegions) {
      const halfWidth = region.width / 2
      const halfHeight = region.height / 2
      if (
        x >= region.x - halfWidth &&
        x <= region.x + halfWidth &&
        y >= region.y - halfHeight &&
        y <= region.y + halfHeight
      ) {
        setSelectedBlurRegion(region.id)
        setSelectedMagnifier(null)
        setIsDragging(true)
        setDragOffset({ x: x - region.x, y: y - region.y })
        e.preventDefault()
        return
      }
    }

    for (let i = magnifiers.length - 1; i >= 0; i--) {
      const mag = magnifiers[i]
      if (isInsideMagnifier(x, y, mag)) {
        setSelectedMagnifier(mag.id)
        setSelectedBlurRegion(null) // Clear blur selection when clicking on magnifier
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
    setSelectedBlurRegion(null)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !image) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    if (isDragging && selectedMagnifier) {
      setMagnifiers((prev) =>
        prev.map((mag) => (mag.id === selectedMagnifier ? { ...mag, x: x - dragOffset.x, y: y - dragOffset.y } : mag)),
      )
    }

    if (isDragging && selectedBlurRegion) {
      const region = blurRegions.find((r) => r.id === selectedBlurRegion)
      if (region) {
        const halfWidth = region.width / 2
        const halfHeight = region.height / 2
        const newX = Math.max(halfWidth, Math.min(canvas.width - halfWidth, x - dragOffset.x))
        const newY = Math.max(halfHeight, Math.min(canvas.height - halfHeight, y - dragOffset.y))
        setBlurRegions((prev) => prev.map((r) => (r.id === selectedBlurRegion ? { ...r, x: newX, y: newY } : r)))
      }
      return
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

    if (isResizing && selectedBlurRegion && dragState) {
      const deltaX = x - dragState.initialX
      const deltaY = y - dragState.initialY
      const newWidth = Math.max(50, dragState.initialWidth + deltaX * 2)
      const newHeight = Math.max(50, dragState.initialHeight + deltaY * 2)
      setBlurRegions((prev) =>
        prev.map((r) => (r.id === selectedBlurRegion ? { ...r, width: newWidth, height: newHeight } : r)),
      )
      return
    }

    let cursor = "default"
    if (selectedMagnifier) {
      const selected = magnifiers.find((m) => m.id === selectedMagnifier)
      if (selected && isOnResizeHandle(x, y, selected)) {
        cursor = "nwse-resize"
      }
    }

    if (selectedBlurRegion) {
      const selected = blurRegions.find((b) => b.id === selectedBlurRegion)
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

    for (const region of blurRegions) {
      const halfWidth = region.width / 2
      const halfHeight = region.height / 2
      if (
        x >= region.x - halfWidth &&
        x <= region.x + halfWidth &&
        y >= region.y - halfHeight &&
        y <= region.y + halfHeight
      ) {
        cursor = "move"
        break
      }
    }

    canvas.style.cursor = cursor
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

    if (isDragging && selectedBlurRegion) {
      e.preventDefault()
      const region = blurRegions.find((r) => r.id === selectedBlurRegion)
      if (region) {
        const canvas = canvasRef.current
        if (canvas) {
          const halfWidth = region.width / 2
          const halfHeight = region.height / 2
          const newX = Math.max(halfWidth, Math.min(canvas.width - halfWidth, x - dragOffset.x))
          const newY = Math.max(halfHeight, Math.min(canvas.height - halfHeight, y - dragOffset.y))
          setBlurRegions((prev) => prev.map((r) => (r.id === selectedBlurRegion ? { ...r, x: newX, y: newY } : r)))
        }
      }
      return
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

    if (isResizing && selectedBlurRegion && dragState) {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const deltaX = x - dragState.initialX
      const deltaY = y - dragState.initialY
      const newWidth = Math.max(50, dragState.initialWidth + deltaX * 2)
      const newHeight = Math.max(50, dragState.initialHeight + deltaY * 2)
      setBlurRegions((prev) =>
        prev.map((r) => (r.id === selectedBlurRegion ? { ...r, width: newWidth, height: newHeight } : r)),
      )
      return
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

    blurRegions.forEach((region) => {
      const scaledX = region.x * scaleX
      const scaledY = region.y * scaleY
      const scaledWidth = region.width * scaleX
      const scaledHeight = region.height * scaleY

      ctx.save()
      ctx.beginPath()
      const halfWidth = scaledWidth / 2
      const halfHeight = scaledHeight / 2
      ctx.roundRect(scaledX - halfWidth, scaledY - halfHeight, scaledWidth, scaledHeight, 8 * Math.min(scaleX, scaleY))
      ctx.clip()

      ctx.filter = `blur(${region.blurAmount}px)`
      ctx.drawImage(
        image,
        scaledX - halfWidth,
        scaledY - halfHeight,
        scaledWidth,
        scaledHeight,
        scaledX - halfWidth,
        scaledY - halfHeight,
        scaledWidth,
        scaledHeight,
      )
      ctx.restore()

      ctx.beginPath()
      ctx.roundRect(scaledX - halfWidth, scaledY - halfHeight, scaledWidth, scaledHeight, 8 * Math.min(scaleX, scaleY))
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)"
      ctx.lineWidth = 1 * Math.min(scaleX, scaleY)
      ctx.stroke()
    })

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
      ctx.strokeStyle = mag.darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
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
      ctx.strokeStyle = mag.darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
      ctx.lineWidth = 1
      ctx.stroke()
    })

    const link = document.createElement("a")
    link.download = "magnified-image.png"
    link.href = exportCanvas.toDataURL("image/png")
    link.click()
  }, [image, magnifiers, blurRegions, canvasDisplaySize])

  const copyToClipboard = useCallback(async () => {
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

    blurRegions.forEach((region) => {
      const scaledX = region.x * scaleX
      const scaledY = region.y * scaleY
      const scaledWidth = region.width * scaleX
      const scaledHeight = region.height * scaleY

      ctx.save()
      ctx.beginPath()
      const halfWidth = scaledWidth / 2
      const halfHeight = scaledHeight / 2
      ctx.roundRect(scaledX - halfWidth, scaledY - halfHeight, scaledWidth, scaledHeight, 8 * Math.min(scaleX, scaleY))
      ctx.clip()

      ctx.filter = `blur(${region.blurAmount}px)`
      ctx.drawImage(
        image,
        scaledX - halfWidth,
        scaledY - halfHeight,
        scaledWidth,
        scaledHeight,
        scaledX - halfWidth,
        scaledY - halfHeight,
        scaledWidth,
        scaledHeight,
      )
      ctx.restore()

      ctx.beginPath()
      ctx.roundRect(scaledX - halfWidth, scaledY - halfHeight, scaledWidth, scaledHeight, 8 * Math.min(scaleX, scaleY))
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)"
      ctx.lineWidth = 1 * Math.min(scaleX, scaleY)
      ctx.stroke()
    })

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
      ctx.strokeStyle = mag.darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
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
      ctx.strokeStyle = mag.darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
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
  }, [image, magnifiers, blurRegions, canvasDisplaySize])

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
    <TooltipProvider delayDuration={300}>
      <div
        className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 md:p-8"
        ref={containerRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        {image && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-2 rounded-full bg-white/70 dark:bg-black/70 backdrop-blur-xl shadow-lg border border-black/10 dark:border-white/10 z-50"
            style={{ animation: "none", transition: "none" }}
          >
            {/* Toolbar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-black/10"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Image</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => addMagnifier("circle")}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-black/10"
                >
                  <div className="relative">
                    <Circle className="h-4 w-4" />
                    <Plus className="h-2 w-2 absolute -top-0.5 -right-0.5" strokeWidth={3} />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Circle Magnifier</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => addMagnifier("rectangle")}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-black/10"
                >
                  <div className="relative">
                    <Square className="h-4 w-4" />
                    <Plus className="h-2 w-2 absolute -top-0.5 -right-0.5" strokeWidth={3} />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Rectangle Magnifier</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={addBlurRegion}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-black/10"
                >
                  <div className="relative">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" opacity="0.5" />
                      <rect x="6" y="6" width="12" height="12" rx="1" opacity="0.3" />
                      <rect x="9" y="9" width="6" height="6" opacity="0.2" />
                    </svg>
                    <Plus className="h-2 w-2 absolute -top-0.5 -right-0.5" strokeWidth={3} />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Blur Region</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={copyToClipboard}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-black/10"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy Image</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={downloadImage}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-black/10"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export Image</TooltipContent>
            </Tooltip>
          </div>
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
          <div
            className={`relative transition-all ${isDragOver ? "ring-4 ring-blue-400 ring-offset-4 rounded-lg" : ""}`}
          >
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

            {magnifiers.map((mag) => {
              const pos = getMagnifierScreenPosition(mag)
              const isSelected = selectedMagnifier === mag.id
              if (!isSelected) return null
              const offsetY = mag.shape === "rectangle" ? mag.height / 2 : pos.radius
              return (
                <div
                  key={mag.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: pos.x,
                    top: pos.y - offsetY - 48,
                    transform: "translateX(-50%)",
                    animation: "none",
                    transition: "none",
                  }}
                >
                  <div
                    className="pointer-events-auto bg-white/80 backdrop-blur-md rounded-full px-2 py-1 flex items-center gap-1.5 shadow-lg border border-white/30"
                    style={{
                      animation: "none",
                      transition: "none",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Slider
                      value={[mag.zoom]}
                      min={1}
                      max={5}
                      step={0.1}
                      onValueChange={(value) => {
                        setMagnifiers((prev) => prev.map((m) => (m.id === mag.id ? { ...m, zoom: value[0] } : m)))
                      }}
                      className="w-20"
                    />

                    <span className="text-[10px] font-medium text-neutral-600 w-7 text-center tabular-nums">
                      {mag.zoom.toFixed(1)}x
                    </span>

                    <div className="w-px h-4 bg-black/10" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => {
                            setMagnifiers((prev) =>
                              prev.map((m) => (m.id === mag.id ? { ...m, darkBorder: !mag.darkBorder } : m)),
                            )
                          }}
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-full hover:bg-black/10"
                        >
                          {mag.darkBorder ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{mag.darkBorder ? "Light Border" : "Dark Border"}</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-4 bg-black/10" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => {
                            setMagnifiers((prev) => prev.filter((m) => m.id !== mag.id))
                            setSelectedMagnifier(null)
                          }}
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-full hover:bg-red-100 text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )
            })}

            {/* Inline controls for blur regions */}
            {blurRegions.map((region) => {
              const canvasRect = canvasRef.current?.getBoundingClientRect()
              if (!canvasRect || !canvasRef.current) return null

              const scaleX = canvasRect.width / canvasRef.current.width
              const scaleY = canvasRect.height / canvasRef.current.height
              const displayX = region.x * scaleX
              const displayY = region.y * scaleY
              const displayHalfHeight = (region.height / 2) * scaleY

              const isSelected = selectedBlurRegion === region.id

              if (!isSelected) return null

              return (
                <div
                  key={`control-${region.id}`}
                  className="absolute flex items-center gap-2 px-2 py-1.5 rounded-full bg-white/90 dark:bg-black/90 backdrop-blur-sm shadow-lg border border-black/10 dark:border-white/10 z-40"
                  style={{
                    left: displayX,
                    top: displayY - displayHalfHeight - 44,
                    transform: "translateX(-50%)",
                    animation: "none",
                    transition: "none",
                  }}
                >
                  <Slider
                    value={[region.blurAmount]}
                    onValueChange={(value) => {
                      setBlurRegions((prev) =>
                        prev.map((r) => (r.id === region.id ? { ...r, blurAmount: value[0] } : r)),
                      )
                    }}
                    min={1}
                    max={30}
                    step={1}
                    className="w-20"
                  />
                  <span className="text-xs font-medium min-w-[32px] text-center">{region.blurAmount}px</span>

                  <div className="w-px h-4 bg-black/10 dark:bg-white/10" />

                  <Button
                    onClick={() => {
                      setBlurRegions((prev) => prev.filter((r) => r.id !== region.id))
                      setSelectedBlurRegion(null)
                    }}
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 rounded-full hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}

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
    </TooltipProvider>
  )
}
