import math
import random
import wave
import struct
import os

SAMPLE_RATE = 48000
OUTPUT = "public/audio"

os.makedirs(OUTPUT, exist_ok=True)
random.seed(42)

def save_wav(filename, samples):
    path = os.path.join(OUTPUT, filename)

    with wave.open(path, "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)

        frames = bytearray()

        for sample in samples:
            sample = max(-1.0, min(1.0, sample))
            value = int(sample * 32767)
            frames.extend(struct.pack("<hh", value, value))

        wav.writeframes(frames)

    print("Created:", path)


# 1. Original tech ambient background music
duration = 20
samples = []

# Soft electronic chord progression
chords = [
    [110.00, 164.81, 220.00],  # A minor
    [130.81, 164.81, 196.00],  # C major
    [87.31, 130.81, 174.61],   # F major
    [98.00, 146.83, 196.00],   # G major
]

for i in range(SAMPLE_RATE * duration):
    t = i / SAMPLE_RATE
    chord_index = int(t / 5) % len(chords)
    chord = chords[chord_index]

    pad = 0

    for j, freq in enumerate(chord):
        pad += math.sin(2 * math.pi * freq * t + j) * 0.10
        pad += math.sin(2 * math.pi * freq * 2 * t) * 0.025

    # Gentle rhythmic electronic pulse
    pulse = (math.sin(2 * math.pi * 2 * t) ** 8) * 0.10

    # Subtle high-frequency movement
    shimmer = math.sin(2 * math.pi * 880 * t) * 0.012

    # Smooth fade in/out
    fade_in = min(1, t / 1.5)
    fade_out = min(1, (duration - t) / 1.5)
    envelope = max(0, min(fade_in, fade_out))

    samples.append((pad + pulse + shimmer) * envelope * 0.55)

save_wav("background-music.wav", samples)


# 2. Whoosh transition effect
duration = 0.65
samples = []
previous_noise = 0

for i in range(int(SAMPLE_RATE * duration)):
    t = i / SAMPLE_RATE
    progress = t / duration

    noise = random.uniform(-1, 1)
    high_noise = noise - previous_noise
    previous_noise = noise

    envelope = math.sin(math.pi * progress) ** 2
    tone = math.sin(2 * math.pi * (180 + 650 * progress) * t)

    value = (high_noise * 0.55 + tone * 0.25) * envelope * 0.35
    samples.append(value)

save_wav("whoosh.wav", samples)


# 3. Short UI click
duration = 0.10
samples = []

for i in range(int(SAMPLE_RATE * duration)):
    t = i / SAMPLE_RATE

    envelope = math.exp(-t * 55)
    tone = math.sin(2 * math.pi * 1250 * t)
    click_noise = random.uniform(-1, 1) * 0.15

    samples.append((tone * 0.7 + click_noise) * envelope * 0.45)

save_wav("click.wav", samples)

print("\nAll audio assets generated successfully.")
