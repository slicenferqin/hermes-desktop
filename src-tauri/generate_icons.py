#!/usr/bin/env python3
from PIL import Image, ImageDraw
import os

def create_gradient_icon(size):
    """Create a gradient icon with indigo theme color."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create a circular gradient (indigo-600 theme)
    center = size // 2
    max_radius = size // 2
    
    for y in range(size):
        for x in range(size):
            # Calculate distance from center
            dx = x - center
            dy = y - center
            distance = (dx*dx + dy*dy) ** 0.5
            
            if distance <= max_radius:
                # indigo-600 gradient (79, 70, 229) -> (99, 102, 241)
                ratio = distance / max_radius
                r = int(79 + (99-79) * ratio)
                g = int(70 + (102-70) * ratio)
                b = int(229 + (241-229) * ratio)
                img.putpixel((x, y), (r, g, b, 255))
    
    return img

def save_png_icon(img, path):
    """Save image as PNG with RGBA mode."""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    img.save(path, 'PNG')
    print(f"Saved: {path} ({img.size[0]}x{img.size[1]}, {img.mode})")

def save_ico_icon(img, path, sizes=None):
    """Save image as ICO file with multiple sizes."""
    if sizes is None:
        sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    # Create list of resized images
    images = []
    for s in sizes:
        resized = img.resize(s, Image.LANCZOS)
        if resized.mode != 'RGBA':
            resized = resized.convert('RGBA')
        images.append(resized)
    
    # Save as ICO
    images[0].save(path, format='ICO', sizes=[(s[0], s[1]) for s in sizes], append_images=images[1:])
    print(f"Saved: {path} (ICO with multiple sizes)")

def save_icns_icon(img, path):
    """Save image as ICNS file (macOS icon)."""
    # ICNS requires specific sizes, we'll use 128x128 as base
    if img.size != (128, 128):
        img = img.resize((128, 128), Image.LANCZOS)
    
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    try:
        # Try to save as ICNS (requires pillow version with ICNS support)
        img.save(path, format='ICNS')
        print(f"Saved: {path} (ICNS format)")
    except Exception as e:
        print(f"Warning: Could not save ICNS format: {e}")
        # Fallback: save as PNG and rename (some tools can handle this)
        png_path = path + '.png'
        img.save(png_path, 'PNG')
        os.rename(png_path, path)
        print(f"Saved as PNG with ICNS extension: {path}")

def main():
    icons_dir = os.path.expanduser('~/projects/hermes-desktop/src-tauri/icons')
    
    # Create the base gradient icon at 1024x1024
    print("Creating gradient icon...")
    base_icon = create_gradient_icon(1024)
    
    # Save PNG icons
    print("\nSaving PNG icons...")
    
    # 32x32.png
    icon_32 = base_icon.resize((32, 32), Image.LANCZOS)
    save_png_icon(icon_32, os.path.join(icons_dir, '32x32.png'))
    
    # 128x128.png
    icon_128 = base_icon.resize((128, 128), Image.LANCZOS)
    save_png_icon(icon_128, os.path.join(icons_dir, '128x128.png'))
    
    # 128x128@2x.png (256x256)
    icon_256 = base_icon.resize((256, 256), Image.LANCZOS)
    save_png_icon(icon_256, os.path.join(icons_dir, '128x128@2x.png'))
    
    # Save ICO icon
    print("\nSaving ICO icon...")
    save_ico_icon(base_icon, os.path.join(icons_dir, 'icon.ico'))
    
    # Save ICNS icon
    print("\nSaving ICNS icon...")
    save_icns_icon(icon_128, os.path.join(icons_dir, 'icon.icns'))
    
    print("\nIcon generation complete!")
    
    # Verify all icons are RGBA
    print("\nVerifying icon formats...")
    files = ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.ico', 'icon.icns']
    for f in files:
        path = os.path.join(icons_dir, f)
        if os.path.exists(path):
            try:
                with Image.open(path) as img:
                    print(f"✓ {f}: {img.size[0]}x{img.size[1]} {img.mode}")
            except Exception as e:
                print(f"✗ {f}: Error - {e}")

if __name__ == '__main__':
    main()