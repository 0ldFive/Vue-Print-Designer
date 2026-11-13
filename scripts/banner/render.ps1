param(
  [string]$OutDir = ".tmp-banner"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$items = Get-Content -Raw -Encoding UTF8 (Join-Path $here "copy.json") | ConvertFrom-Json
$logoPath = Join-Path $here "..\..\src\assets\logo.png"

$W = 1200
$H = 400
$FRAMES = 32

function Clamp01([double]$v) {
  if ($v -lt 0) { return 0.0 }
  if ($v -gt 1) { return 1.0 }
  return $v
}

function EaseOut([double]$t) {
  $u = 1.0 - $t
  return 1.0 - ($u * $u * $u)
}

function Lerp([double]$a, [double]$b, [double]$t) {
  return $a + ($b - $a) * $t
}

function New-RoundPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $radius = [Math]::Min($r, [Math]::Min($w, $h) / 2.0)
  $d = $radius * 2.0
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Get-Font([string]$family, [single]$size, $style) {
  $candidate = $family
  try {
    $test = New-Object System.Drawing.FontFamily($candidate)
    $test.Dispose()
  }
  catch {
    $candidate = "Segoe UI"
  }
  return New-Object System.Drawing.Font($candidate, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-SolidBrush([int]$a, [int]$r, [int]$g, [int]$b) {
  return New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($a, $r, $g, $b))
}

function Draw-ImageA($graphics, $image, [double]$x, [double]$y, [double]$w, [double]$h, [int]$alpha) {
  if ($null -eq $image -or $alpha -le 0) { return }
  $dest = New-Object System.Drawing.Rectangle([int][math]::Round($x), [int][math]::Round($y), [int][math]::Round($w), [int][math]::Round($h))
  if ($alpha -ge 255) {
    $graphics.DrawImage($image, $dest, (New-Object System.Drawing.Rectangle(0, 0, $image.Width, $image.Height)), [System.Drawing.GraphicsUnit]::Pixel)
    return
  }
  $ia = New-Object System.Drawing.Imaging.ImageAttributes
  $cm = New-Object System.Drawing.Imaging.ColorMatrix
  $cm.Matrix33 = [single]($alpha / 255.0)
  $ia.SetColorMatrix($cm)
  $graphics.DrawImage($image, $dest, 0, 0, $image.Width, $image.Height, [System.Drawing.GraphicsUnit]::Pixel, $ia)
  $ia.Dispose()
}

# ---- light background, rendered once and reused ----
$bg = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bgg = [System.Drawing.Graphics]::FromImage($bg)
$bgg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect,
  [System.Drawing.Color]::FromArgb(255, 255, 255, 255),
  [System.Drawing.Color]::FromArgb(255, 232, 240, 250),
  25
)
$bgg.FillRectangle($grad, $rect)

$dotBrush = New-SolidBrush 255 223 232 242
for ($x = 16; $x -lt $W; $x += 40) {
  for ($y = 16; $y -lt $H; $y += 40) {
    $bgg.FillEllipse($dotBrush, $x, $y, 2, 2)
  }
}

$glow = New-SolidBrush 70 191 219 254
$bgg.FillEllipse($glow, $W - 440, -260, 660, 560)
$glow2 = New-SolidBrush 56 186 230 253
$bgg.FillEllipse($glow2, -220, $H - 300, 560, 460)

$barTop = $H - 4
$barRect = New-Object System.Drawing.Rectangle(0, $barTop, $W, 4)
$barGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $barRect,
  [System.Drawing.Color]::FromArgb(0, 37, 99, 235),
  [System.Drawing.Color]::FromArgb(0, 34, 211, 238),
  0
)
$blend = New-Object System.Drawing.Drawing2D.ColorBlend(4)
$blend.Colors = @(
  [System.Drawing.Color]::FromArgb(0, 37, 99, 235),
  [System.Drawing.Color]::FromArgb(240, 37, 99, 235),
  [System.Drawing.Color]::FromArgb(240, 6, 182, 212),
  [System.Drawing.Color]::FromArgb(0, 6, 182, 212)
)
$blend.Positions = @(0.0, 0.3, 0.7, 1.0)
$barGrad.InterpolationColors = $blend
$bgg.FillRectangle($barGrad, $barRect)

$bgg.Dispose()

# ---- real product logo ----
$logoImg = [System.Drawing.Image]::FromFile($logoPath)

# ---- per language frames ----
if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$cardX = 88.0
$cardY = 118.0
$cardSize = 112.0
$cardR = 26.0
$titleX = 248.0
$featX = 744.0

foreach ($item in $items) {
  $langDir = Join-Path $OutDir $item.lang
  New-Item -ItemType Directory -Force -Path $langDir | Out-Null

  $titleFont = Get-Font $item.font 48 ([System.Drawing.FontStyle]::Bold)
  $subFont = Get-Font $item.font 21 ([System.Drawing.FontStyle]::Regular)
  $tagFont = Get-Font $item.font 14 ([System.Drawing.FontStyle]::Regular)
  $featFont = Get-Font $item.font 19 ([System.Drawing.FontStyle]::Regular)
  $quoteFont = Get-Font $item.font 16 ([System.Drawing.FontStyle]::Regular)
  $byFont = Get-Font $item.font 14 ([System.Drawing.FontStyle]::Regular)

  $iconCache = @{}
  foreach ($tg in $item.tags) {
    $iconKey = [string]$tg.icon
    if ([string]::IsNullOrEmpty($iconKey) -or $iconCache.ContainsKey($iconKey)) { continue }
    $iconPath = Join-Path $here ("icons\" + $iconKey + ".png")
    if (Test-Path $iconPath) {
      $iconCache[$iconKey] = [System.Drawing.Image]::FromFile($iconPath)
    }
  }

  $measureBmp = New-Object System.Drawing.Bitmap($W, $H)
  $measureG = [System.Drawing.Graphics]::FromImage($measureBmp)

  for ($f = 0; $f -lt $FRAMES; $f++) {
    $bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $g.DrawImage($bg, 0, 0, $W, $H)

    # logo card
    $logoA = EaseOut (Clamp01($f / 8.0))
    if ($logoA -gt 0.001) {
      $scale = Lerp 0.72 1.0 $logoA
      $size = $cardSize * $scale
      $lx = ($cardX + $cardSize / 2.0) - $size / 2.0
      $ly = ($cardY + $cardSize / 2.0) - $size / 2.0
      $r = $cardR * $scale
      $cardA = [int](255 * $logoA)

      $shadow1 = New-RoundPath ($lx - 4.0) ($ly + 10.0) ($size + 8.0) ($size + 8.0) ($r + 4.0)
      $sb1 = New-SolidBrush ([int]($cardA * 0.04)) 100 116 139
      $g.FillPath($sb1, $shadow1)
      $shadow2 = New-RoundPath ($lx - 1.0) ($ly + 4.0) ($size + 2.0) ($size + 2.0) ($r + 1.0)
      $sb2 = New-SolidBrush ([int]($cardA * 0.06)) 100 116 139
      $g.FillPath($sb2, $shadow2)

      $cardPath = New-RoundPath $lx $ly $size $size $r
      $cardBrush = New-SolidBrush $cardA 255 255 255
      $g.FillPath($cardBrush, $cardPath)

      $state = $g.Save()
      $g.SetClip($cardPath)
      $g.DrawImage($logoImg, [single]$lx, [single]$ly, [single]$size, [single]$size)
      $g.Restore($state)

      $edgePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb([int]($cardA * 0.9), 214, 226, 240), 1.4)
      $g.DrawPath($edgePen, $cardPath)

      $edgePen.Dispose()
      $cardBrush.Dispose()
      $cardPath.Dispose()
      $sb2.Dispose()
      $shadow2.Dispose()
      $sb1.Dispose()
      $shadow1.Dispose()
    }

    # title
    $titleA = EaseOut (Clamp01(($f - 3) / 10.0))
    if ($titleA -gt 0.001) {
      $dy = Lerp 16.0 0.0 $titleA
      $brush = New-SolidBrush ([int](255 * $titleA)) 11 23 39
      $g.DrawString($item.title, $titleFont, $brush, $titleX, (102.0 + $dy))
      $brush.Dispose()
    }

    # subtitle
    $subA = EaseOut (Clamp01(($f - 7) / 10.0))
    if ($subA -gt 0.001) {
      $dy = Lerp 12.0 0.0 $subA
      $brush = New-SolidBrush ([int](255 * $subA)) 88 104 122
      $g.DrawString($item.subtitle, $subFont, $brush, ($titleX + 2.0), (174.0 + $dy))
      $brush.Dispose()
    }

    # framework pills
    $tagX = $titleX
    $tagY = 222.0
    for ($t = 0; $t -lt $item.tags.Count; $t++) {
      $tagItem = $item.tags[$t]
      $tag = [string]$tagItem.label
      $iconKey = [string]$tagItem.icon
      $logo = $null
      if (-not [string]::IsNullOrEmpty($iconKey)) { $logo = $iconCache[$iconKey] }
      $start = 11 + $t * 2
      $tagA = EaseOut (Clamp01(($f - $start) / 5.0))
      $pillFmt = [System.Drawing.StringFormat]::GenericTypographic
      $measured = $measureG.MeasureString($tag, $tagFont, [single]10000, $pillFmt)
      $pillW = $measured.Width + 28.0
      $textX = 15.0
      if ($null -ne $logo) {
        $pillW += 11.0
        $textX = 30.0
      }
      $pillH = 34.0
      if ($tagA -gt 0.001) {
        $dy = Lerp 10.0 0.0 $tagA
        $tc = [int](255 * $tagA)
        $pillPath = New-RoundPath $tagX ($tagY + $dy) $pillW $pillH ($pillH / 2.0)
        $fill = New-SolidBrush ([int]($tc * 0.85)) 255 255 255
        $g.FillPath($fill, $pillPath)
        $edge = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb([int]($tc * 0.95), 211, 224, 240), 1.0)
        $g.DrawPath($edge, $pillPath)
        if ($null -ne $logo) {
          Draw-ImageA $g $logo ($tagX + 9.0) ($tagY + $dy + 9.5) 15.0 15.0 $tc
        }
        $tb = New-SolidBrush $tc 51 70 95
        $g.DrawString($tag, $tagFont, $tb, ($tagX + $textX), ($tagY + $dy + ($pillH - $measured.Height) / 2.0), $pillFmt)
        $tb.Dispose()
        $edge.Dispose()
        $fill.Dispose()
        $pillPath.Dispose()
      }
      $tagX += $pillW + 6.0
    }

    # product features
    for ($i = 0; $i -lt $item.features.Count; $i++) {
      $feat = [string]$item.features[$i]
      $start = 14 + $i * 3
      $featA = EaseOut (Clamp01(($f - $start) / 6.0))
      if ($featA -gt 0.001) {
        $rowY = 96.0 + $i * 54.0
        $dx = Lerp 16.0 0.0 $featA
        $fc = [int](255 * $featA)
        $dotColor = if ($i % 2 -eq 0) { @(37, 99, 235) } else { @(6, 182, 212) }
        $dot = New-SolidBrush $fc $dotColor[0] $dotColor[1] $dotColor[2]
        $g.FillEllipse($dot, [single]($featX + $dx), [single]($rowY + 9.0), 9, 9)
        $dot.Dispose()
        $fb = New-SolidBrush $fc 31 50 71
        $g.DrawString($feat, $featFont, $fb, ($featX + 28.0 + $dx), $rowY)
        $fb.Dispose()
      }
    }

    # design philosophy quote with attribution, centered at the bottom
    $quoteA = EaseOut (Clamp01(($f - 22) / 6.0))
    if ($quoteA -gt 0.001) {
      $qc = [int](255 * $quoteA)
      $qy = 330.0
      $tfmt = [System.Drawing.StringFormat]::GenericTypographic
      $quoteW = $measureG.MeasureString($item.quote, $quoteFont, [single]10000, $tfmt).Width
      $byW = $measureG.MeasureString($item.quoteBy, $byFont, [single]10000, $tfmt).Width
      $totalW = 15.0 + $quoteW + 6.0 + $byW
      $qx = [double](($W - $totalW) / 2.0)
      $markBrush = New-SolidBrush $qc 37 99 235
      $g.FillRectangle($markBrush, [single]$qx, [single]($qy + 3.0), 3.0, 18.0)
      $markBrush.Dispose()
      $qb = New-SolidBrush $qc 76 95 117
      $g.DrawString($item.quote, $quoteFont, $qb, [single]($qx + 15.0), [single]$qy, $tfmt)
      $qb.Dispose()
      $bb = New-SolidBrush $qc 147 163 184
      $g.DrawString($item.quoteBy, $byFont, $bb, [single]($qx + 15.0 + $quoteW + 6.0), [single]($qy + 3.0), $tfmt)
      $bb.Dispose()
    }

    $g.Dispose()
    $framePath = Join-Path $langDir ("f{0:d3}.png" -f $f)
    $bmp.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  }

  $measureG.Dispose()
  $measureBmp.Dispose()
  $titleFont.Dispose()
  $subFont.Dispose()
  $tagFont.Dispose()
  $featFont.Dispose()
  $quoteFont.Dispose()
  $byFont.Dispose()
  foreach ($img in $iconCache.Values) { $img.Dispose() }
  Write-Output ("rendered " + $item.lang)
}

$logoImg.Dispose()
$bg.Dispose()
Write-Output "done"
