# Genera los íconos de la PWA a partir de public/iconos/logo-original.jpg (usa System.Drawing de Windows).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/generar-iconos.ps1
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $raiz "public\iconos"
$origen = [Drawing.Image]::FromFile((Join-Path $dir "logo-original.jpg"))
$lectura = New-Object Drawing.Bitmap $origen
$W = $origen.Width; $H = $origen.Height

# Color de fondo: el verde del recuadro (tomado dentro del borde)
$verde = $lectura.GetPixel([int]($W * 0.10), [int]($H * 0.5))
"Tamaño original: ${W}x${H}  · verde: #{0:X2}{1:X2}{2:X2}" -f $verde.R, $verde.G, $verde.B

# Recorte interior: quita el margen blanco y el borde redondeado del dibujo
$m = 0.115
$recorte = New-Object Drawing.Rectangle ([int]($W * $m)), ([int]($H * $m)), ([int]($W * (1 - 2 * $m))), ([int]($H * (1 - 2 * $m)))

function Guardar([int]$lado, [double]$escala, [string]$nombre) {
  $lienzo = New-Object Drawing.Bitmap $lado, $lado
  $g = [Drawing.Graphics]::FromImage($lienzo)
  $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($verde)
  $t = [int]($lado * $escala); $o = [int](($lado - $t) / 2)
  $g.DrawImage($origen, (New-Object Drawing.Rectangle $o, $o, $t, $t), $recorte, [Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $lienzo.Save((Join-Path $dir $nombre), [Drawing.Imaging.ImageFormat]::Png)
  $lienzo.Dispose()
  "  $nombre ($lado px)"
}

Guardar 192 1.0 "icono-192.png"
Guardar 512 1.0 "icono-512.png"
Guardar 512 0.80 "icono-maskable-512.png"   # zona segura: Android lo recorta en círculo
Guardar 180 1.0 "apple-touch-icon.png"
Guardar 32 1.0 "favicon-32.png"

$lectura.Dispose(); $origen.Dispose()
