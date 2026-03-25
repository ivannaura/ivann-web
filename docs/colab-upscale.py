# ============================================
# IVANN AURA — Frame Enhancement Pipeline
# Run this in Google Colab (GPU runtime)
# ============================================
#
# Steps:
# 1. Upload your frames zip to Google Drive
# 2. Set GPU runtime: Runtime > Change runtime type > GPU
# 3. Run all cells
#
# Output: Enhanced frames at 2x resolution + RIFE interpolated frames

# %% [Cell 1] Install dependencies
# !pip install realesrgan gfpgan rife-ncnn-vulkan-python
# !pip install basicsr facexlib
# !pip install torch torchvision

# For Real-ESRGAN
# !wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth -P weights/
# !wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x2plus.pth -P weights/

# %% [Cell 2] Mount Google Drive
# from google.colab import drive
# drive.mount('/content/drive')

# %% [Cell 3] Configuration
import os

INPUT_DIR = "/content/drive/MyDrive/ivann-frames/input"   # Upload frames here
OUTPUT_DIR = "/content/drive/MyDrive/ivann-frames/output"  # Enhanced frames go here
RIFE_DIR = "/content/drive/MyDrive/ivann-frames/interpolated"  # RIFE output

SCALE = 2  # 2x upscale (720p -> 1440p)

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(RIFE_DIR, exist_ok=True)

# %% [Cell 4] Real-ESRGAN Upscale
"""
Real-ESRGAN upscales each frame from 720p to 1440p.
Uses the x2plus model which is best for real-world photos/video.
"""
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
import cv2
import glob
from tqdm import tqdm

model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=2)
upsampler = RealESRGANer(
    scale=2,
    model_path='weights/RealESRGAN_x2plus.pth',
    model=model,
    tile=400,         # Process in tiles to save memory
    tile_pad=10,
    pre_pad=0,
    half=True         # FP16 for speed
)

frames = sorted(glob.glob(os.path.join(INPUT_DIR, "*.webp")) +
                glob.glob(os.path.join(INPUT_DIR, "*.jpg")) +
                glob.glob(os.path.join(INPUT_DIR, "*.png")))

print(f"Found {len(frames)} frames to upscale")

for frame_path in tqdm(frames, desc="Upscaling"):
    img = cv2.imread(frame_path, cv2.IMREAD_UNCHANGED)
    output, _ = upsampler.enhance(img, outscale=SCALE)

    filename = os.path.basename(frame_path)
    name = os.path.splitext(filename)[0]
    output_path = os.path.join(OUTPUT_DIR, f"{name}.webp")
    cv2.imwrite(output_path, output, [cv2.IMWRITE_WEBP_QUALITY, 90])

print(f"Done! {len(frames)} frames upscaled to {OUTPUT_DIR}")

# %% [Cell 5] RIFE Frame Interpolation
"""
RIFE creates intermediate frames between existing ones.
This doubles the frame count for smoother scroll animation.
Input: N frames -> Output: 2N-1 frames
"""
import subprocess

# Install RIFE
# !pip install rife-ncnn-vulkan-python

from rife_ncnn_vulkan import Rife
from PIL import Image
import numpy as np

rife = Rife(gpuid=0, model="rife-v4.6")

upscaled_frames = sorted(glob.glob(os.path.join(OUTPUT_DIR, "*.webp")))
print(f"Interpolating {len(upscaled_frames)} frames...")

output_idx = 0
for i in tqdm(range(len(upscaled_frames) - 1), desc="Interpolating"):
    img0 = Image.open(upscaled_frames[i])
    img1 = Image.open(upscaled_frames[i + 1])

    # Save original frame
    img0.save(os.path.join(RIFE_DIR, f"frame-{output_idx:04d}.webp"), quality=90)
    output_idx += 1

    # Generate and save interpolated frame
    mid = rife.process(img0, img1)
    mid.save(os.path.join(RIFE_DIR, f"frame-{output_idx:04d}.webp"), quality=90)
    output_idx += 1

# Save last frame
Image.open(upscaled_frames[-1]).save(
    os.path.join(RIFE_DIR, f"frame-{output_idx:04d}.webp"), quality=90
)

print(f"Done! {output_idx + 1} interpolated frames saved to {RIFE_DIR}")
print(f"Original: {len(upscaled_frames)} frames -> Interpolated: {output_idx + 1} frames")

# %% [Cell 6] Create zip for download
import shutil
shutil.make_archive("/content/ivann-enhanced-frames", "zip", RIFE_DIR)
print("Download: /content/ivann-enhanced-frames.zip")

# To download from Colab:
# from google.colab import files
# files.download("/content/ivann-enhanced-frames.zip")
