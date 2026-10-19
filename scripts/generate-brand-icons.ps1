Add-Type -AssemblyName System.Drawing

$logoSource = "D:\WORKMAN SERVICES\public\logo.png"
$workmanMobileDir = "d:\WMS-APP 1\workman-mobile"
$assetsDir = Join-Path $workmanMobileDir "assets"
$resDir = Join-Path $workmanMobileDir "android\app\src\main\res"

if (-not (Test-Path $logoSource)) {
    Write-Error "Source logo not found at $logoSource"
    exit 1
}

# 1. Copy raw high-res logo to assets
$logoAssetPath = Join-Path $assetsDir "workman-logo.png"
Copy-Item -Path $logoSource -Destination $logoAssetPath -Force
Write-Host "Copied logo to $logoAssetPath"

$src = [System.Drawing.Image]::FromFile($logoSource)

function Export-Icon {
    param(
        [string]$Path,
        [int]$Size,
        [double]$WidthRatio,
        [bool]$Transparent = $false
    )
    $canvas = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($Transparent) {
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        $g.Clear([System.Drawing.Color]::White)
    }

    $targetW = [int]($Size * $WidthRatio)
    $targetH = [int]($targetW * $src.Height / $src.Width)
    $x = [int](($Size - $targetW) / 2)
    $y = [int](($Size - $targetH) / 2)

    $g.DrawImage($src, $x, $y, $targetW, $targetH)

    # Ensure parent dir exists
    $parent = Split-Path $Path -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $canvas.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $canvas.Dispose()
    Write-Host "Generated: $Path ($Size x $Size)"
}

# 2. Main Expo assets
Export-Icon -Path (Join-Path $assetsDir "icon.png") -Size 1024 -WidthRatio 0.72 -Transparent $false
Export-Icon -Path (Join-Path $assetsDir "android-icon-foreground.png") -Size 1024 -WidthRatio 0.54 -Transparent $true
Export-Icon -Path (Join-Path $assetsDir "splash-icon.png") -Size 512 -WidthRatio 0.70 -Transparent $true
Export-Icon -Path (Join-Path $assetsDir "favicon.png") -Size 64 -WidthRatio 0.85 -Transparent $false

# 3. Android mipmap directories (launcher icons)
$densities = @(
    @{ Name = "mipmap-mdpi"; Size = 48; ForeSize = 108 },
    @{ Name = "mipmap-hdpi"; Size = 72; ForeSize = 162 },
    @{ Name = "mipmap-xhdpi"; Size = 96; ForeSize = 216 },
    @{ Name = "mipmap-xxhdpi"; Size = 144; ForeSize = 324 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192; ForeSize = 432 }
)

foreach ($d in $densities) {
    $dir = Join-Path $resDir $d.Name

    Remove-Item (Join-Path $dir "ic_launcher.webp") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $dir "ic_launcher_round.webp") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $dir "ic_launcher_foreground.webp") -ErrorAction SilentlyContinue

    Export-Icon -Path (Join-Path $dir "ic_launcher.png") -Size $d.Size -WidthRatio 0.72 -Transparent $false
    Export-Icon -Path (Join-Path $dir "ic_launcher_round.png") -Size $d.Size -WidthRatio 0.72 -Transparent $false
    Export-Icon -Path (Join-Path $dir "ic_launcher_foreground.png") -Size $d.ForeSize -WidthRatio 0.54 -Transparent $true
}

# 4. Android splashscreen drawables
$splashDensities = @(
    @{ Name = "drawable-mdpi"; Size = 288 },
    @{ Name = "drawable-hdpi"; Size = 432 },
    @{ Name = "drawable-xhdpi"; Size = 576 },
    @{ Name = "drawable-xxhdpi"; Size = 864 },
    @{ Name = "drawable-xxxhdpi"; Size = 1152 }
)

foreach ($s in $splashDensities) {
    $dir = Join-Path $resDir $s.Name
    Export-Icon -Path (Join-Path $dir "splashscreen_logo.png") -Size $s.Size -WidthRatio 0.75 -Transparent $true
}

$src.Dispose()
Write-Host "All brand icons, mipmaps, and splashscreen resources generated successfully!"
