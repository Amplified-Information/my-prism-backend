import numpy as np
from PIL import Image
import sys

# Load the lossless PNG directly
if len(sys.argv) < 2:
    raise SystemExit("Usage: python extractMetadata.py <image_path>")

img_path = sys.argv[1]
data = np.array(Image.open(img_path)).flatten()

# Extract the least significant bit of each byte
bits = "".join(str(val & 1) for val in data)
bytes_data = [bits[i:i+8] for i in range(0, len(bits), 8)]

# Reconstruct the string until the null terminator
chars = []
for b in bytes_data:
    code = int(b, 2)
    if code == 0:
        break
    chars.append(chr(code))
print("".join(chars))
