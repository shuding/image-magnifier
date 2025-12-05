"use client"

import type React from "react"
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition, // Add useTransition import
} from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, Circle, Square, Copy, Download, Trash2, Sun, Moon, Check, EyeOff, Grid3X3, Waves } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { stackBlurCanvas } from "@/lib/stackblur"

// Helper function to apply Gaussian blur to ImageData
const applyGaussianBlur = (imageData: ImageData, radius: number) => {
  const { data } = imageData
  const width = imageData.width
  const height = imageData.height

  const blurRadius = Math.min(Math.round(radius), 254)
  const sigma = blurRadius * 0.5 // Approximation for stackblur to Gaussian
  const diameter = Math.ceil(blurRadius * 2)
  const kernelSize = diameter + 1
  const halfKernelSize = Math.floor(kernelSize / 2)

  // Pre-calculate Gaussian kernel weights
  const kernel: number[] = []
  let kernelSum = 0
  for (let i = 0; i < kernelSize; i++) {
    const x = i - halfKernelSize
    const weight = Math.exp(-(x * x) / (2 * sigma * sigma))
    kernel.push(weight)
    kernelSum += weight
  }

  // Normalize kernel weights
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= kernelSum
  }

  const tempData = new Uint8ClampedArray(data)

  // Apply horizontal blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      for (let k = 0; k < kernelSize; k++) {
        const sampleX = x + k - halfKernelSize
        if (sampleX >= 0 && sampleX < width) {
          const index = (y * width + sampleX) * 4
          r += tempData[index] * kernel[k]
          g += tempData[index + 1] * kernel[k]
          b += tempData[index + 2] * kernel[k]
          a += tempData[index + 3] * kernel[k]
        }
      }
      const index = (y * width + x) * 4
      data[index] = r
      data[index + 1] = g
      data[index + 2] = b
      data[index + 3] = a
    }
  }

  // Apply vertical blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      for (let k = 0; k < kernelSize; k++) {
        const sampleY = y + k - halfKernelSize
        if (sampleY >= 0 && sampleY < height) {
          const index = (sampleY * width + x) * 4
          r += data[index] * kernel[k]
          g += data[index + 1] * kernel[k]
          b += data[index + 2] * kernel[k]
          a += data[index + 3] * kernel[k]
        }
      }
      const index = (y * width + x) * 4
      data[index] = r
      data[index + 1] = g
      data[index + 2] = b
      data[index + 3] = a
    }
  }
}

function drawImageWithEdgeExtension(
  tempCtx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
) {
  // Clamp source coordinates to image bounds
  const imgW = image.naturalWidth
  const imgH = image.naturalHeight

  // Calculate the valid region we can actually draw from the image
  const validSrcX = Math.max(0, srcX)
  const validSrcY = Math.max(0, srcY)
  const validSrcRight = Math.min(imgW, srcX + srcW)
  const validSrcBottom = Math.min(imgH, srcY + srcH)
  const validSrcW = validSrcRight - validSrcX
  const validSrcH = validSrcBottom - validSrcY

  // If completely outside image, fill with edge color
  if (validSrcW <= 0 || validSrcH <= 0) {
    return
  }

  // Calculate where in the destination this valid region maps to
  const scaleX = destW / srcW
  const scaleY = destH / srcH
  const destX = (validSrcX - srcX) * scaleX
  const destY = (validSrcY - srcY) * scaleY
  const destValidW = validSrcW * scaleX
  const destValidH = validSrcH * scaleY

  // Draw the valid portion of the image
  tempCtx.drawImage(image, validSrcX, validSrcY, validSrcW, validSrcH, destX, destY, destValidW, destValidH)

  // Now extend edges to fill the padding areas
  // This prevents blur fade-out at image boundaries

  // Left edge extension
  if (srcX < 0 && destX > 0) {
    // Sample a 1px column from the left edge of valid area and stretch it
    tempCtx.drawImage(tempCtx.canvas, destX, destY, 1, destValidH, 0, destY, destX, destValidH)
  }

  // Right edge extension
  if (srcX + srcW > imgW) {
    const rightEdgeX = destX + destValidW
    const rightFillW = destW - rightEdgeX
    if (rightFillW > 0) {
      tempCtx.drawImage(tempCtx.canvas, rightEdgeX - 1, destY, 1, destValidH, rightEdgeX, destY, rightFillW, destValidH)
    }
  }

  // Top edge extension
  if (srcY < 0 && destY > 0) {
    tempCtx.drawImage(tempCtx.canvas, 0, destY, destW, 1, 0, 0, destW, destY)
  }

  // Bottom edge extension
  if (srcY + srcH > imgH) {
    const bottomEdgeY = destY + destValidH
    const bottomFillH = destH - bottomEdgeY
    if (bottomFillH > 0) {
      tempCtx.drawImage(tempCtx.canvas, 0, bottomEdgeY - 1, destW, 1, 0, bottomEdgeY, destW, bottomFillH)
    }
  }
}

interface Annotation {
  id: string
  x: number
  y: number
  radius: number
  width: number
  height: number
  zoom: number
  shape: "circle" | "rectangle"
  darkBorder: boolean
  type: "magnifier" | "blur"
  blurAmount: number
  blurType: "gaussian" | "mosaic"
}

export function ImageMagnifierTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
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
  const [selectedBorderColor, setSelectedBorderColor] = useState<string>("#3B82F6")

  const [isPending, startTransition] = useTransition()
  // Remove: blurCacheRef, isInteractingRef, lastDrawTimeRef

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotation) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault()
        setAnnotations((prev) => prev.filter((ann) => ann.id !== selectedAnnotation))
        setSelectedAnnotation(null)
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
  }, [selectedAnnotation])

  const calculateBlur = useCallback(
    (ann: Annotation): ImageData | null => {
      if (ann.type !== "blur" || !image) return null

      const tempCanvas = document.createElement("canvas")
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true })
      if (!tempCtx) return null

      const blurRadius = Math.min(Math.round(ann.blurAmount), 40)
      const padding = blurRadius * 2

      const scaleX = image.naturalWidth / canvasDisplaySize.width
      const scaleY = image.naturalHeight / canvasDisplaySize.height

      if (ann.shape === "rectangle") {
        const regionWidth = Math.ceil(ann.width)
        const regionHeight = Math.ceil(ann.height)
        const paddedWidth = regionWidth + padding * 2
        const paddedHeight = regionHeight + padding * 2

        tempCanvas.width = paddedWidth
        tempCanvas.height = paddedHeight

        const srcX = (ann.x - ann.width / 2) * scaleX - padding * scaleX
        const srcY = (ann.y - ann.height / 2) * scaleY - padding * scaleY
        const srcW = paddedWidth * scaleX
        const srcH = paddedHeight * scaleY

        drawImageWithEdgeExtension(tempCtx, image, srcX, srcY, srcW, srcH, paddedWidth, paddedHeight)

        const imageData = tempCtx.getImageData(0, 0, paddedWidth, paddedHeight)

        if (ann.blurType === "mosaic") {
          applyMosaic(imageData, Math.max(8, Math.floor(blurRadius / 2)))
        } else {
          applyGaussianBlur(imageData, blurRadius)
        }

        return imageData
      } else {
        const diameter = Math.ceil(ann.radius * 2)
        const paddedSize = diameter + padding * 2

        tempCanvas.width = paddedSize
        tempCanvas.height = paddedSize

        const srcX = (ann.x - ann.radius) * scaleX - padding * scaleX
        const srcY = (ann.y - ann.radius) * scaleY - padding * scaleY
        const srcW = paddedSize * scaleX
        const srcH = paddedSize * scaleY

        drawImageWithEdgeExtension(tempCtx, image, srcX, srcY, srcW, srcH, paddedSize, paddedSize)

        const imageData = tempCtx.getImageData(0, 0, paddedSize, paddedSize)

        if (ann.blurType === "mosaic") {
          applyMosaic(imageData, Math.max(8, Math.floor(blurRadius / 2)))
        } else {
          applyGaussianBlur(imageData, blurRadius)
        }

        return imageData
      }
    },
    [image, canvasDisplaySize],
  )

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !image || canvasDisplaySize.width === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasDisplaySize.width, canvasDisplaySize.height)
    ctx.drawImage(image, 0, 0, canvasDisplaySize.width, canvasDisplaySize.height)

    annotations.forEach((ann) => {
      ctx.save()

      ctx.beginPath()
      if (ann.shape === "rectangle") {
        const halfWidth = ann.width / 2
        const halfHeight = ann.height / 2
        ctx.roundRect(ann.x - halfWidth, ann.y - halfHeight, ann.width, ann.height, 8)
      } else {
        ctx.arc(ann.x, ann.y, ann.radius, 0, Math.PI * 2)
      }
      ctx.clip()

      const scaleX = image.naturalWidth / canvasDisplaySize.width
      const scaleY = image.naturalHeight / canvasDisplaySize.height
      const sourceX = ann.x * scaleX
      const sourceY = ann.y * scaleY

      if (ann.type === "blur") {
        const blurRadius = Math.min(Math.round(ann.blurAmount), 40)
        const padding = blurRadius * 2

        const blurredData = calculateBlur(ann)

        if (blurredData) {
          const tempCanvas = document.createElement("canvas")
          tempCanvas.width = blurredData.width
          tempCanvas.height = blurredData.height
          const tempCtx = tempCanvas.getContext("2d")
          if (tempCtx) {
            tempCtx.putImageData(blurredData, 0, 0)

            if (ann.shape === "rectangle") {
              ctx.drawImage(
                tempCanvas,
                padding,
                padding,
                ann.width,
                ann.height,
                ann.x - ann.width / 2,
                ann.y - ann.height / 2,
                ann.width,
                ann.height,
              )
            } else {
              ctx.drawImage(
                tempCanvas,
                padding,
                padding,
                ann.radius * 2,
                ann.radius * 2,
                ann.x - ann.radius,
                ann.y - ann.radius,
                ann.radius * 2,
                ann.radius * 2,
              )
            }
          }
        }
      } else {
        // Original magnifier logic
        if (ann.shape === "rectangle") {
          const zoomWidth = ann.width / 2 / ann.zoom
          const zoomHeight = ann.height / 2 / ann.zoom
          ctx.drawImage(
            image,
            sourceX - zoomWidth * scaleX,
            sourceY - zoomHeight * scaleY,
            zoomWidth * 2 * scaleX,
            zoomHeight * 2 * scaleY,
            ann.x - ann.width / 2,
            ann.y - ann.height / 2,
            ann.width,
            ann.height,
          )
        } else {
          const zoomRadius = ann.radius / ann.zoom
          ctx.drawImage(
            image,
            sourceX - zoomRadius * scaleX,
            sourceY - zoomRadius * scaleY,
            zoomRadius * 2 * scaleX,
            zoomRadius * 2 * scaleY,
            ann.x - ann.radius,
            ann.y - ann.radius,
            ann.radius * 2,
            ann.radius * 2,
          )
        }
      }

      ctx.restore()

      // Only draw borders for magnifiers, not blur regions
      if (ann.type !== "blur") {
        ctx.save()
        ctx.beginPath()
        if (ann.shape === "rectangle") {
          const halfWidth = ann.width / 2 + 1
          const halfHeight = ann.height / 2 + 1
          ctx.roundRect(ann.x - halfWidth, ann.y - halfHeight, halfWidth * 2, halfHeight * 2, 8)
        } else {
          ctx.arc(ann.x, ann.y, ann.radius + 1, 0, Math.PI * 2)
        }
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
        ctx.shadowBlur = 15
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 4
        ctx.strokeStyle = ann.darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()

        ctx.beginPath()
        if (ann.shape === "rectangle") {
          const halfWidth = ann.width / 2 + 1
          const halfHeight = ann.height / 2 + 1
          ctx.roundRect(ann.x - halfWidth, ann.y - halfHeight, halfWidth * 2, halfHeight * 2, 8)
        } else {
          ctx.arc(ann.x, ann.y, ann.radius + 1, 0, Math.PI * 2)
        }
        ctx.strokeStyle = ann.darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
        ctx.lineWidth = 1
        ctx.stroke()
      }

      if (selectedAnnotation === ann.id) {
        ctx.save()
        ctx.beginPath()
        if (ann.shape === "rectangle") {
          const halfWidth = ann.width / 2 + 4
          const halfHeight = ann.height / 2 + 4
          ctx.roundRect(ann.x - halfWidth, ann.y - halfHeight, halfWidth * 2, halfHeight * 2, 10)
        } else {
          ctx.arc(ann.x, ann.y, ann.radius + 4, 0, Math.PI * 2)
        }
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()

        let handleX: number, handleY: number
        if (ann.shape === "rectangle") {
          handleX = ann.x + ann.width / 2 + 4
          handleY = ann.y + ann.height / 2 + 4
        } else {
          const outlineRadius = ann.radius + 4
          handleX = ann.x + outlineRadius * Math.cos(Math.PI / 4)
          handleY = ann.y + outlineRadius * Math.sin(Math.PI / 4)
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
  }, [image, annotations, canvasDisplaySize, selectedAnnotation, calculateBlur])

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
        setAnnotations([])
        setSelectedAnnotation(null)
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

  const addAnnotation = (shape: "circle" | "rectangle" = "circle", type: "magnifier" | "blur" = "magnifier") => {
    if (!canvasDisplaySize.width) return
    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      x: canvasDisplaySize.width / 2,
      y: canvasDisplaySize.height / 2,
      radius: 60,
      width: 120,
      height: 120,
      zoom: 2,
      shape,
      darkBorder: darkBorder,
      type,
      blurAmount: 20,
      blurType: "gaussian",
    }
    setAnnotations([...annotations, newAnnotation])
    setSelectedAnnotation(newAnnotation.id)
  }

  const applyMosaic = (imageData: ImageData, blockSize: number) => {
    const { data } = imageData
    const width = imageData.width
    const height = imageData.height

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          count = 0

        // Calculate average color for this block
        for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4
            r += data[idx]
            g += data[idx + 1]
            b += data[idx + 2]
            a += data[idx + 3]
            count++
          }
        }

        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)
        a = Math.round(a / count)

        // Fill block with average color
        for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
            data[idx + 3] = a
          }
        }
      }
    }
    // No need to put back into context, it modifies imageData directly
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

  const isOnResizeHandle = (x: number, y: number, ann: Annotation) => {
    let handleX: number, handleY: number
    if (ann.shape === "rectangle") {
      handleX = ann.x + ann.width / 2 + 4
      handleY = ann.y + ann.height / 2 + 4
    } else {
      const outlineRadius = ann.radius + 4
      handleX = ann.x + outlineRadius * Math.cos(Math.PI / 4)
      handleY = ann.y + outlineRadius * Math.sin(Math.PI / 4)
    }
    const dist = Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2)
    return dist <= 12
  }

  const isInsideAnnotation = (x: number, y: number, ann: Annotation) => {
    if (ann.shape === "rectangle") {
      const halfWidth = ann.width / 2
      const halfHeight = ann.height / 2
      return x >= ann.x - halfWidth && x <= ann.x + halfWidth && y >= ann.y - halfHeight && y <= ann.y + halfHeight
    }
    const dist = Math.sqrt((x - ann.x) ** 2 + (y - ann.y) ** 2)
    return dist <= ann.radius
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (selectedAnnotation) {
      const selected = annotations.find((m) => m.id === selectedAnnotation)
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

    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i]
      if (isInsideAnnotation(x, y, ann)) {
        setSelectedAnnotation(ann.id)
        setIsDragging(true)
        setDragOffset({ x: x - ann.x, y: y - ann.y })
        setDragState({
          x,
          y,
          initialX: ann.x,
          initialY: ann.y,
          initialWidth: ann.width,
          initialHeight: ann.height,
          initialRadius: ann.radius,
          shape: ann.shape,
        })
        return
      }
    }

    setSelectedAnnotation(null)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return
    const { x, y } = getTouchCoords(e)

    if (selectedAnnotation) {
      const selected = annotations.find((m) => m.id === selectedAnnotation)
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

    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i]
      if (isInsideAnnotation(x, y, ann)) {
        setSelectedAnnotation(ann.id)
        setIsDragging(true)
        setDragOffset({ x: x - ann.x, y: y - ann.y })
        setDragState({
          x,
          y,
          initialX: ann.x,
          initialY: ann.y,
          initialWidth: ann.width,
          initialHeight: ann.height,
          initialRadius: ann.radius,
          shape: ann.shape,
        })
        e.preventDefault()
        return
      }
    }

    setSelectedAnnotation(null)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isDragging && selectedAnnotation) {
      startTransition(() => {
        setAnnotations((prev) =>
          prev.map((ann) =>
            ann.id === selectedAnnotation
              ? {
                  ...ann,
                  x: Math.max(0, Math.min(canvasDisplaySize.width, x - dragOffset.x)),
                  y: Math.max(0, Math.min(canvasDisplaySize.height, y - dragOffset.y)),
                }
              : ann,
          ),
        )
      })
    } else if (isResizing && selectedAnnotation && dragState) {
      startTransition(() => {
        setAnnotations((prev) =>
          prev.map((ann) => {
            if (ann.id !== selectedAnnotation) return ann

            if (ann.shape === "rectangle") {
              const dx = x - dragState.x
              const dy = y - dragState.y
              const newWidth = Math.max(50, dragState.initialWidth + dx * 2)
              const newHeight = Math.max(50, dragState.initialHeight + dy * 2)
              return { ...ann, width: newWidth, height: newHeight }
            } else {
              const newRadius = Math.max(25, Math.hypot(x - ann.x, y - ann.y))
              return { ...ann, radius: newRadius }
            }
          }),
        )
      })
    } else {
      let cursor = "default"
      if (selectedAnnotation) {
        const selected = annotations.find((m) => m.id === selectedAnnotation)
        if (selected && isOnResizeHandle(x, y, selected)) {
          cursor = "nwse-resize"
        }
      }
      for (const ann of annotations) {
        if (isInsideAnnotation(x, y, ann)) {
          cursor = "move"
          break
        }
      }
      canvas.style.cursor = cursor
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging && !isResizing) return
    e.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    if (isDragging && selectedAnnotation) {
      startTransition(() => {
        setAnnotations((prev) =>
          prev.map((ann) =>
            ann.id === selectedAnnotation
              ? {
                  ...ann,
                  x: Math.max(0, Math.min(canvasDisplaySize.width, x - dragOffset.x)),
                  y: Math.max(0, Math.min(canvasDisplaySize.height, y - dragOffset.y)),
                }
              : ann,
          ),
        )
      })
    } else if (isResizing && selectedAnnotation && dragState) {
      startTransition(() => {
        setAnnotations((prev) =>
          prev.map((ann) => {
            if (ann.id !== selectedAnnotation) return ann

            if (ann.shape === "rectangle") {
              const dx = x - dragState.x
              const dy = y - dragState.y
              const newWidth = Math.max(50, dragState.initialWidth + dx * 2)
              const newHeight = Math.max(50, dragState.initialHeight + dy * 2)
              return { ...ann, width: newWidth, height: newHeight }
            } else {
              const newRadius = Math.max(25, Math.hypot(x - ann.x, y - ann.y))
              return { ...ann, radius: newRadius }
            }
          }),
        )
      })
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

    annotations.forEach((ann) => {
      const scaledX = ann.x * scaleX
      const scaledY = ann.y * scaleY
      const scaledRadius = ann.radius * Math.min(scaleX, scaleY)
      const scaledWidth = ann.width * scaleX
      const scaledHeight = ann.height * scaleY

      ctx.save()
      ctx.beginPath()
      if (ann.shape === "rectangle") {
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

      if (ann.type === "blur") {
        const tempCanvas = document.createElement("canvas")
        const tempCtx = tempCanvas.getContext("2d")
        if (tempCtx) {
          const scaledBlur = Math.round(ann.blurAmount * Math.min(scaleX, scaleY) * dpr)
          const blurRadius = Math.min(scaledBlur, 254) // Cap at 254 for stackblur table
          const padding = blurRadius * 2

          if (ann.shape === "rectangle") {
            const regionWidth = Math.ceil(scaledWidth * dpr)
            const regionHeight = Math.ceil(scaledHeight * dpr)
            const paddedWidth = regionWidth + padding * 2
            const paddedHeight = regionHeight + padding * 2
            tempCanvas.width = paddedWidth
            tempCanvas.height = paddedHeight

            const paddingInImage = padding / dpr

            // Use the new helper function
            drawImageWithEdgeExtension(
              tempCtx,
              image,
              scaledX - scaledWidth / 2 - paddingInImage,
              scaledY - scaledHeight / 2 - paddingInImage,
              scaledWidth + paddingInImage * 2,
              scaledHeight + paddingInImage * 2,
              paddedWidth,
              paddedHeight,
            )

            // Apply blur or mosaic based on blurType
            if (ann.blurType === "mosaic") {
              applyMosaic(
                tempCtx.getImageData(0, 0, paddedWidth, paddedHeight),
                Math.max(4, Math.floor(blurRadius / 2)),
              )
              tempCtx.putImageData(tempCtx.getImageData(0, 0, paddedWidth, paddedHeight), 0, 0)
            } else {
              stackBlurCanvas(tempCanvas, 0, 0, paddedWidth, paddedHeight, blurRadius)
            }

            ctx.drawImage(
              tempCanvas,
              padding,
              padding,
              regionWidth,
              regionHeight,
              scaledX - scaledWidth / 2,
              scaledY - scaledHeight / 2,
              scaledWidth,
              scaledHeight,
            )
          } else {
            const regionSize = Math.ceil(scaledRadius * 2 * dpr)
            const paddedSize = regionSize + padding * 2
            tempCanvas.width = paddedSize
            tempCanvas.height = paddedSize

            const paddingInImage = padding / dpr

            // Use the new helper function
            drawImageWithEdgeExtension(
              tempCtx,
              image,
              scaledX - scaledRadius - paddingInImage,
              scaledY - scaledRadius - paddingInImage,
              scaledRadius * 2 + paddingInImage * 2,
              scaledRadius * 2 + paddingInImage * 2,
              paddedSize,
              paddedSize,
            )

            // Apply blur or mosaic based on blurType
            if (ann.blurType === "mosaic") {
              applyMosaic(tempCtx.getImageData(0, 0, paddedSize, paddedSize), Math.max(4, Math.floor(blurRadius / 2)))
              tempCtx.putImageData(tempCtx.getImageData(0, 0, paddedSize, paddedSize), 0, 0)
            } else {
              stackBlurCanvas(tempCanvas, 0, 0, paddedSize, paddedSize, blurRadius)
            }

            ctx.drawImage(
              tempCanvas,
              padding,
              padding,
              regionSize,
              regionSize,
              scaledX - scaledRadius,
              scaledY - scaledRadius,
              scaledRadius * 2,
              scaledRadius * 2,
            )
          }
        }
      } else {
        if (ann.shape === "rectangle") {
          const zoomWidth = scaledWidth / 2 / ann.zoom
          const zoomHeight = scaledHeight / 2 / ann.zoom
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
          const zoomRadius = scaledRadius / ann.zoom
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
      }
      ctx.restore()

      if (ann.type !== "blur") {
        ctx.save()
        ctx.beginPath()
        if (ann.shape === "rectangle") {
          ctx.roundRect(
            scaledX - scaledWidth / 2,
            scaledY - scaledHeight / 2,
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
        ctx.strokeStyle = ann.darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
        ctx.lineWidth = 2 * Math.min(scaleX, scaleY)
        ctx.stroke()
        ctx.restore()

        ctx.beginPath()
        if (ann.shape === "rectangle") {
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
        ctx.strokeStyle = ann.darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })

    const link = document.createElement("a")
    link.download = "magnified-image.png"
    link.href = exportCanvas.toDataURL("image/png")
    link.click()
  }, [image, annotations, canvasDisplaySize])

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

    annotations.forEach((ann) => {
      const scaledX = ann.x * scaleX
      const scaledY = ann.y * scaleY
      const scaledRadius = ann.radius * Math.min(scaleX, scaleY)
      const scaledWidth = ann.width * scaleX
      const scaledHeight = ann.height * scaleY

      ctx.save()
      ctx.beginPath()
      if (ann.shape === "rectangle") {
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

      if (ann.type === "blur") {
        const tempCanvas = document.createElement("canvas")
        const tempCtx = tempCanvas.getContext("2d")
        if (tempCtx) {
          const scaledBlur = Math.round(ann.blurAmount * Math.min(scaleX, scaleY) * dpr)
          const blurRadius = Math.min(scaledBlur, 254) // Cap at 254 for stackblur table
          const padding = blurRadius * 2

          if (ann.shape === "rectangle") {
            const regionWidth = Math.ceil(scaledWidth * dpr)
            const regionHeight = Math.ceil(scaledHeight * dpr)
            const paddedWidth = regionWidth + padding * 2
            const paddedHeight = regionHeight + padding * 2
            tempCanvas.width = paddedWidth
            tempCanvas.height = paddedHeight

            const paddingInImage = padding / dpr

            // Use the new helper function
            drawImageWithEdgeExtension(
              tempCtx,
              image,
              scaledX - scaledWidth / 2 - paddingInImage,
              scaledY - scaledHeight / 2 - paddingInImage,
              scaledWidth + paddingInImage * 2,
              scaledHeight + paddingInImage * 2,
              paddedWidth,
              paddedHeight,
            )

            // Apply blur or mosaic based on blurType
            if (ann.blurType === "mosaic") {
              applyMosaic(
                tempCtx.getImageData(0, 0, paddedWidth, paddedHeight),
                Math.max(4, Math.floor(blurRadius / 2)),
              )
              tempCtx.putImageData(tempCtx.getImageData(0, 0, paddedWidth, paddedHeight), 0, 0)
            } else {
              stackBlurCanvas(tempCanvas, 0, 0, paddedWidth, paddedHeight, blurRadius)
            }

            ctx.drawImage(
              tempCanvas,
              padding,
              padding,
              regionWidth,
              regionHeight,
              scaledX - scaledWidth / 2,
              scaledY - scaledHeight / 2,
              scaledWidth,
              scaledHeight,
            )
          } else {
            const regionSize = Math.ceil(scaledRadius * 2 * dpr)
            const paddedSize = regionSize + padding * 2
            tempCanvas.width = paddedSize
            tempCanvas.height = paddedSize

            const paddingInImage = padding / dpr

            // Use the new helper function
            drawImageWithEdgeExtension(
              tempCtx,
              image,
              scaledX - scaledRadius - paddingInImage,
              scaledY - scaledRadius - paddingInImage,
              scaledRadius * 2 + paddingInImage * 2,
              scaledRadius * 2 + paddingInImage * 2,
              paddedSize,
              paddedSize,
            )

            // Apply blur or mosaic based on blurType
            if (ann.blurType === "mosaic") {
              applyMosaic(tempCtx.getImageData(0, 0, paddedSize, paddedSize), Math.max(4, Math.floor(blurRadius / 2)))
              tempCtx.putImageData(tempCtx.getImageData(0, 0, paddedSize, paddedSize), 0, 0)
            } else {
              stackBlurCanvas(tempCanvas, 0, 0, paddedSize, paddedSize, blurRadius)
            }

            ctx.drawImage(
              tempCanvas,
              padding,
              padding,
              regionSize,
              regionSize,
              scaledX - scaledRadius,
              scaledY - scaledRadius,
              scaledRadius * 2,
              scaledRadius * 2,
            )
          }
        }
      } else {
        if (ann.shape === "rectangle") {
          const zoomWidth = scaledWidth / 2 / ann.zoom
          const zoomHeight = scaledHeight / 2 / ann.zoom
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
          const zoomRadius = scaledRadius / ann.zoom
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
      }
      ctx.restore()

      if (ann.type !== "blur") {
        ctx.save()
        ctx.beginPath()
        if (ann.shape === "rectangle") {
          ctx.roundRect(
            scaledX - scaledWidth / 2,
            scaledY - scaledHeight / 2,
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
        ctx.strokeStyle = ann.darkBorder ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)"
        ctx.lineWidth = 2 * Math.min(scaleX, scaleY)
        ctx.stroke()
        ctx.restore()

        ctx.beginPath()
        if (ann.shape === "rectangle") {
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
        ctx.strokeStyle = ann.darkBorder ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
        ctx.lineWidth = 1
        ctx.stroke()
      }
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
  }, [image, annotations, canvasDisplaySize])

  const getAnnotationScreenPosition = (ann: Annotation) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, radius: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / canvasDisplaySize.width
    const scaleY = rect.height / canvasDisplaySize.height
    return {
      x: ann.x * scaleX,
      y: ann.y * scaleY,
      radius:
        ann.shape === "rectangle"
          ? (Math.max(ann.width, ann.height) / 2) * Math.min(scaleX, scaleY)
          : ann.radius * Math.min(scaleX, scaleY),
    }
  }

  const handleBlurAmountChange = useCallback((id: string, value: number) => {
    setAnnotations((prev) => prev.map((ann) => (ann.id === id ? { ...ann, blurAmount: value } : ann)))
  }, [])

  const handleBlurTypeChange = useCallback((id: string, type: "gaussian" | "mosaic") => {
    setAnnotations((prev) => prev.map((ann) => (ann.id === id ? { ...ann, blurType: type } : ann)))
  }, [])

  const handleBlurAmountChangeEnd = useCallback(
    (id: string) => {
      const ann = annotations.find((a) => a.id === id)
      if (ann && ann.type === "blur") {
        // Force recalculate blur directly
        // (No cache to invalidate anymore)
        drawCanvas()
      }
    },
    [annotations, drawCanvas],
  )

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
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-white/70 backdrop-blur-xl rounded-full px-2 py-1.5 flex items-center gap-1 shadow-lg border border-white/20">
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

              <div className="w-px h-5 bg-black/10 mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => addAnnotation("circle", "magnifier")}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full hover:bg-black/10"
                  >
                    <Circle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Circle Magnifier</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => addAnnotation("rectangle", "magnifier")}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full hover:bg-black/10"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Rectangle Magnifier</TooltipContent>
              </Tooltip>

              <div className="w-px h-5 bg-black/10 mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => addAnnotation("rectangle", "blur")}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full hover:bg-black/10"
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Blur</TooltipContent>
              </Tooltip>

              <div className="w-px h-5 bg-black/10 mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={copyImage}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full hover:bg-black/10"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{copied ? "Copied!" : "Copy Image"}</TooltipContent>
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

            {annotations.map((ann) => {
              const pos = getAnnotationScreenPosition(ann)
              const isSelected = selectedAnnotation === ann.id
              if (!isSelected) return null
              const offsetY = ann.shape === "rectangle" ? ann.height / 2 : pos.radius
              return (
                <div
                  key={ann.id}
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
                    {ann.type === "blur" ? (
                      <>
                        {/* Update slider onValueChange to use startTransition */}
                        <Slider
                          min={1}
                          max={40}
                          step={1}
                          value={[ann.blurAmount]}
                          onValueChange={(value) => {
                            startTransition(() => {
                              setAnnotations((prev) =>
                                prev.map((a) => (a.id === ann.id ? { ...a, blurAmount: value[0] } : a)),
                              )
                            })
                          }}
                          onValueCommit={() => {
                            // Trigger redraw after commit
                            drawCanvas()
                          }}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground w-8">{ann.blurAmount}px</span>

                        <div className="w-px h-4 bg-black/10" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => {
                                handleBlurTypeChange(ann.id, ann.blurType === "gaussian" ? "mosaic" : "gaussian")
                                // No need for redraw here as drawCanvas() is called after interaction ends
                              }}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-black/10"
                            >
                              {ann.blurType === "gaussian" ? (
                                <Waves className="h-3 w-3" />
                              ) : (
                                <Grid3X3 className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{ann.blurType === "gaussian" ? "Gaussian Blur" : "Mosaic"}</TooltipContent>
                        </Tooltip>

                        <div className="w-px h-4 bg-black/10" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => {
                                setAnnotations((prev) => prev.filter((m) => m.id !== ann.id))
                                setSelectedAnnotation(null)
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
                      </>
                    ) : (
                      // Magnifier annotation menu - unchanged
                      <>
                        <Slider
                          value={[ann.zoom]}
                          min={1}
                          max={5}
                          step={0.1}
                          onValueChange={(value) => {
                            setAnnotations((prev) => prev.map((m) => (m.id === ann.id ? { ...m, zoom: value[0] } : m)))
                          }}
                          className="w-20"
                        />
                        <span className="text-[10px] font-medium text-neutral-600 w-7 text-center tabular-nums">
                          {ann.zoom.toFixed(1)}x
                        </span>

                        <div className="w-px h-4 bg-black/10" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => {
                                setAnnotations((prev) =>
                                  prev.map((m) => (m.id === ann.id ? { ...m, darkBorder: !ann.darkBorder } : m)),
                                )
                              }}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-black/10"
                            >
                              {ann.darkBorder ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{ann.darkBorder ? "Light Border" : "Dark Border"}</TooltipContent>
                        </Tooltip>

                        <div className="w-px h-4 bg-black/10" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => {
                                setAnnotations((prev) => prev.filter((m) => m.id !== ann.id))
                                setSelectedAnnotation(null)
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
                      </>
                    )}
                  </div>
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
