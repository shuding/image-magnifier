"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, Plus, Download, Copy, Trash2, Check, Menu, X } from "lucide-react"

interface Magnifier {
  id: string
  x: number
  y: number
  radius: number
  zoom: number
}

function getImagePixelData(image: HTMLImageElement): ImageData | null {
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function samplePixel(imageData: ImageData, x: number, y: number): [number, number, number, number] {
  const { width, height, data } = imageData

  // Clamp coordinates
  x = Math.max(0, Math.min(width - 1, x))
  y = Math.max(0, Math.min(height - 1, y))

  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, width - 1)
  const y1 = Math.min(y0 + 1, height - 1)

  const fx = x - x0
  const fy = y - y0

  const getPixel = (px: number, py: number): [number, number, number, number] => {
    const i = (py * width + px) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }

  const p00 = getPixel(x0, y0)
  const p10 = getPixel(x1, y0)
  const p01 = getPixel(x0, y1)
  const p11 = getPixel(x1, y1)

  const r = p00[0] * (1 - fx) * (1 - fy) + p10[0] * fx * (1 - fy) + p01[0] * (1 - fx) * fy + p11[0] * fx * fy
  const g = p00[1] * (1 - fx) * (1 - fy) + p10[1] * fx * (1 - fy) + p01[1] * (1 - fx) * fy + p11[1] * fx * fy
  const b = p00[2] * (1 - fx) * (1 - fy) + p10[2] * fx * (1 - fy) + p01[2] * (1 - fx) * fy + p11[2] * fx * fy
  const a = p00[3] * (1 - fx) * (1 - fy) + p10[3] * fx * (1 - fy) + p01[3] * (1 - fx) * fy + p11[3] * fx * fy

  return [r, g, b, a]
}

function drawLiquidGlassMagnifier(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  mag: { x: number; y: number; radius: number; zoom: number },
  canvasWidth: number,
  canvasHeight: number,
  isSelected: boolean,
) {
  const { x: centerX, y: centerY, radius, zoom } = mag
  const imgWidth = imageData.width
  const imgHeight = imageData.height

  // Scale factors from canvas to image coordinates
  const scaleX = imgWidth / canvasWidth
  const scaleY = imgHeight / canvasHeight

  // Source center in image coordinates
  const srcCenterX = centerX * scaleX
  const srcCenterY = centerY * scaleY

  const diameter = Math.ceil(radius * 2)
  const offscreen = document.createElement("canvas")
  offscreen.width = diameter
  offscreen.height = diameter
  const offCtx = offscreen.getContext("2d")
  if (!offCtx) return

  const outputData = offCtx.createImageData(diameter, diameter)
  const out = outputData.data

  const radiusSq = radius * radius

  const edgeStart = 0.85 // Distortion only starts at 85% from center
  const distortionStrength = 0.25 // How much the edge bends

  for (let py = 0; py < diameter; py++) {
    for (let px = 0; px < diameter; px++) {
      // Position relative to magnifier center
      const dx = px - radius
      const dy = py - radius
      const distSq = dx * dx + dy * dy

      if (distSq >= radiusSq) continue

      const dist = Math.sqrt(distSq)
      const normDist = dist / radius // 0 at center, 1 at edge

      let distortion = 1
      if (normDist > edgeStart) {
        // Smooth ramp from 0 to 1 in the edge zone
        const edgeProgress = (normDist - edgeStart) / (1 - edgeStart)
        // Use smoothstep for natural curve
        const smooth = edgeProgress * edgeProgress * (3 - 2 * edgeProgress)
        distortion = 1 + distortionStrength * smooth
      }

      // Convert canvas pixel offset to image pixel offset, apply zoom and distortion
      const sampleDx = (dx * scaleX * distortion) / zoom
      const sampleDy = (dy * scaleY * distortion) / zoom

      // Sample position in image coordinates
      const sampleX = srcCenterX + sampleDx
      const sampleY = srcCenterY + sampleDy

      // Get the pixel color with bilinear interpolation
      let [r, g, b, a] = samplePixel(imageData, sampleX, sampleY)

      if (normDist > edgeStart) {
        const edgeProgress = (normDist - edgeStart) / (1 - edgeStart)

        // Subtle vignette at the very edge
        const vignette = 1 - 0.15 * edgeProgress * edgeProgress
        r *= vignette
        g *= vignette
        b *= vignette

        // Normalized direction from center
        const ndx = dx / dist
        const ndy = dy / dist
        // Light coming from top-left (-0.7, -0.7 normalized)
        const lightDot = -0.707 * ndx + -0.707 * ndy // dot product with light direction
        // Rim intensity increases toward edge, modulated by light direction
        const rimIntensity = edgeProgress * edgeProgress * 0.4
        const rimLight = rimIntensity * (0.5 + 0.5 * lightDot) // 0 to rimIntensity based on angle

        const warmTint = Math.max(0, lightDot) * edgeProgress * 0.12
        const coolTint = Math.max(0, -lightDot) * edgeProgress * 0.08

        r = Math.min(255, r + 255 * rimLight + 255 * warmTint)
        g = Math.min(255, g + 255 * rimLight * 0.9)
        b = Math.min(255, b + 255 * rimLight * 0.85 + 255 * coolTint)
      }

      const specX = 0
      const specY = -0.55
      const specDx = dx / radius - specX
      const specDy = dy / radius - specY
      const specDist = Math.sqrt(specDx * specDx + specDy * specDy)
      const specIntensity = Math.max(0, 1 - specDist * 3) * 0.15
      const specFalloff = specIntensity * specIntensity // sharper falloff

      r = Math.min(255, r + 255 * specFalloff)
      g = Math.min(255, g + 255 * specFalloff)
      b = Math.min(255, b + 255 * specFalloff)

      // Combine effects
      const i = (py * diameter + px) * 4
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
      out[i + 3] = a
    }
  }

  offCtx.putImageData(outputData, 0, 0)

  // Draw to main canvas with circular clip
  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(offscreen, centerX - radius, centerY - radius)
  ctx.restore()

  const gradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius)
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.7)")
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.4)")
  gradient.addColorStop(1, "rgba(200, 200, 220, 0.3)")

  // Draw border with shadow
  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)"
  ctx.shadowBlur = 20
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 6
  ctx.strokeStyle = isSelected ? "#3b82f6" : gradient
  ctx.lineWidth = isSelected ? 3 : 2.5
  ctx.stroke()
  ctx.restore()

  if (!isSelected) {
    const innerGradient = ctx.createLinearGradient(
      centerX - radius,
      centerY - radius,
      centerX + radius,
      centerY + radius,
    )
    innerGradient.addColorStop(0, "rgba(255, 255, 255, 0.25)")
    innerGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)")

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius - 1.5, 0, Math.PI * 2)
    ctx.strokeStyle = innerGradient
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Draw resize handle if selected
  if (isSelected) {
    const handleX = centerX + radius * Math.cos(Math.PI / 4)
    const handleY = centerY + radius * Math.sin(Math.PI / 4)
    ctx.beginPath()
    ctx.arc(handleX, handleY, 8, 0, Math.PI * 2)
    ctx.fillStyle = "#3b82f6"
    ctx.fill()
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

export function ImageMagnifierTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imagePixelData, setImagePixelData] = useState<ImageData | null>(null)
  const [magnifiers, setMagnifiers] = useState<Magnifier[]>([])
  const [selectedMagnifier, setSelectedMagnifier] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [copied, setCopied] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 })
  const [isPanelOpen, setIsPanelOpen] = useState(false)

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

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedMagnifier])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !image || !imagePixelData || canvasDisplaySize.width === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasDisplaySize.width, canvasDisplaySize.height)
    ctx.drawImage(image, 0, 0, canvasDisplaySize.width, canvasDisplaySize.height)

    magnifiers.forEach((mag) => {
      drawLiquidGlassMagnifier(
        ctx,
        imagePixelData,
        mag,
        canvasDisplaySize.width,
        canvasDisplaySize.height,
        selectedMagnifier === mag.id,
      )
    })
  }, [image, imagePixelData, magnifiers, selectedMagnifier, canvasDisplaySize])

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
        setImagePixelData(getImagePixelData(img))
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

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e)

    if (selectedMagnifier) {
      const selected = magnifiers.find((m) => m.id === selectedMagnifier)
      if (selected && isOnResizeHandle(x, y, selected)) {
        setIsResizing(true)
        return
      }
    }

    for (let i = magnifiers.length - 1; i >= 0; i--) {
      const mag = magnifiers[i]
      const dist = Math.sqrt((x - mag.x) ** 2 + (y - mag.y) ** 2)
      if (dist <= mag.radius) {
        setSelectedMagnifier(mag.id)
        setIsDragging(true)
        setDragOffset({ x: x - mag.x, y: y - mag.y })
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
        e.preventDefault()
        return
      }
    }

    for (let i = magnifiers.length - 1; i >= 0; i--) {
      const mag = magnifiers[i]
      const dist = Math.sqrt((x - mag.x) ** 2 + (y - mag.y) ** 2)
      if (dist <= mag.radius) {
        setSelectedMagnifier(mag.id)
        setIsDragging(true)
        setDragOffset({ x: x - mag.x, y: y - mag.y })
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
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setIsResizing(false)
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

  const downloadImage = () => {
    if (!image || !imagePixelData) return

    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = image.naturalWidth
    tempCanvas.height = image.naturalHeight
    const ctx = tempCanvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height)

    const scaleX = image.naturalWidth / canvasDisplaySize.width
    const scaleY = image.naturalHeight / canvasDisplaySize.height

    magnifiers.forEach((mag) => {
      const scaledMag = {
        x: mag.x * scaleX,
        y: mag.y * scaleY,
        radius: mag.radius * Math.min(scaleX, scaleY),
        zoom: mag.zoom,
      }
      drawLiquidGlassMagnifier(
        ctx,
        imagePixelData,
        scaledMag,
        image.naturalWidth,
        image.naturalHeight,
        false, // never show selection in export
      )
    })

    const link = document.createElement("a")
    link.download = "magnified-image.png"
    link.href = tempCanvas.toDataURL("image/png")
    link.click()
  }

  const copyImage = async () => {
    if (!image || !imagePixelData) return

    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = image.naturalWidth
    tempCanvas.height = image.naturalHeight
    const ctx = tempCanvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height)

    const scaleX = image.naturalWidth / canvasDisplaySize.width
    const scaleY = image.naturalHeight / canvasDisplaySize.height

    magnifiers.forEach((mag) => {
      const scaledMag = {
        x: mag.x * scaleX,
        y: mag.y * scaleY,
        radius: mag.radius * Math.min(scaleX, scaleY),
        zoom: mag.zoom,
      }
      drawLiquidGlassMagnifier(ctx, imagePixelData, scaledMag, image.naturalWidth, image.naturalHeight, false)
    })

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
                Add
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 h-8 text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                New Image
              </Button>
            </div>

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
