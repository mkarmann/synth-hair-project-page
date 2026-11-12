"""Render the web assets used by index.html into static/media/.

Sources are the paper's hero renders, the MetaHuman wall tiles from the
NeurIPS visuals and the model predictions on AI-generated portraits used in the
qualitative paper figures.

    uv run python hair_matting/project_page/tools/build_assets.py
"""
import json
import os

import cv2
import numpy as np
from matplotlib import cm
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'static', 'media')
VISUALS = os.path.join(os.path.dirname(ROOT), 'neurips_visuals_claude')
PORTRAITS = '/mnt/disk8/datasets/synthetic_portraits'

HERO_LAYERS = ['rgb', 'matte', 'categories', 'growth', 'depth']
WALL_IDS = [65, 86, 108, 276, 170, 55, 78, 115, 183, 270, 284, 285,
            88, 58, 173, 196, 172, 206, 227, 303, 490, 66, 158, 169]
WALL_LAYERS = ['rgb', 'matte', 'growth', 'depth']

# (short title, file stem, zoom rect as in figure_train_on_real_comparison_highres_v2.py)
EXAMPLES = [
    ('Long wavy hair', 'A person with long wavy hair and stud earrings stands in a works_gs_5.0_3072x4096_seed_12803', (0.45, 0.72, 0.1, 0.1)),
    ('Tight curls', 'A person with tight, dark curls and large silver hoop earrings. _gs_5.0_3072x4096_seed_4041', (0.34, 0.3, 0.1, 0.1)),
    ('Rainbow hair', 'A person with rainbow-colored hair vlogging themselves in front _gs_5.0_3072x4096_seed_19640', (0.3, 0.15, 0.1, 0.1)),
    ('Buzz cut', 'A South Asian man with a short buzzed haircut where individual h_gs_5.0_3072x4096_seed_77', (0.4, 0.2, 0.075, 0.075)),
    ('Wind-blown ginger', 'A person with messy, wind-blown ginger hair where every stray st_gs_5.0_3072x4096_seed_12381', None),
    ('Twists & beard', 'A sharp, high-resolution portrait of an older African man in a s_gs_5.0_3072x4096_seed_1121', None),
    ('Silver beard', 'An older Mediterranean man with fine, gray hair at the sides of _gs_5.0_3072x4096_seed_7125', None),
]
MODELS = [  # (key, prediction folder, display name)
    ('ours', 'H2M2x4096', 'SynthHair (ours)'),
    ('hisa', 'H2M2xHiSa', 'HiSa'),
    ('figaro', 'H2M2xFigaro', 'Figaro-1k'),
    ('celeba', 'H2M2xCelebScalp', 'CelebAMask-HQ'),
]
CATEGORY_COLORS = np.array([  # scalp, eyebrows, eyelashes, mustache, beard
    [255, 64, 64], [255, 214, 0], [255, 64, 255], [40, 230, 90], [64, 120, 255]], np.float32) / 255
EXPLORER_SIZE = None  # native 4096 x 3072


def save_webp(rgb, path, size=None, quality=84):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = Image.fromarray(rgb)
    if size is not None:
        im = im.resize(size, Image.LANCZOS)
    im.save(path, 'WEBP', quality=quality, method=6)
    print(path, im.size, f'{os.path.getsize(path) / 1024:.0f} KiB')


def read_rgb(path):
    return cv2.cvtColor(cv2.imread(path, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)


def soft_ipq(alpha):
    gy, gx = np.gradient(alpha.astype(np.float64))
    area = alpha.sum()
    return float(np.sqrt(gx ** 2 + gy ** 2).sum() ** 2 / (4 * np.pi * area)) if area > 0 else 0.0


def on_black(rgb01, alpha01):
    return np.clip(np.round(rgb01 * alpha01[..., None] * 255), 0, 255).astype(np.uint8)


def build_hero():
    for layer in HERO_LAYERS:
        img = read_rgb(os.path.join(VISUALS, 'assets', 'hero', f'{layer}_2k.jpg'))
        save_webp(img, os.path.join(OUT, 'hero', f'{layer}.webp'), (1600, 1600), quality=86)


def build_wall():
    for i in WALL_IDS:
        for layer in WALL_LAYERS:
            img = read_rgb(os.path.join(VISUALS, 'assets', 'wall', f'{i:07d}_{layer}.jpg'))
            save_webp(img, os.path.join(OUT, 'wall', f'{i:07d}_{layer}.webp'), (360, 360), quality=72)


def build_explorer():
    manifest = {'models': [{'key': k, 'name': n} for k, _, n in MODELS], 'examples': []}
    for idx, (title, stem, zoom) in enumerate(EXAMPLES):
        slug = f'p{idx}'
        out = os.path.join(OUT, 'explorer', slug)
        image = read_rgb(os.path.join(PORTRAITS, 'images', f'{stem}.png'))
        save_webp(image, os.path.join(out, 'image.webp'), EXPLORER_SIZE)
        save_webp(image, os.path.join(out, 'thumb.webp'), (320, 240), quality=78)

        sipq = {}
        for key, folder, _ in MODELS:
            pred_dir = os.path.join(PORTRAITS, 'predictions', folder)
            matte = cv2.imread(os.path.join(pred_dir, 'matte', f'{stem}.png'), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
            category_path = os.path.join(pred_dir, 'hair_category', f'{stem}.npy')
            if os.path.exists(category_path):
                category = np.load(category_path)
                # Scalp-hair alpha only, so the comparison with scalp-only training sets is fair.
                scalp = matte * category[:, :, 0]
                sipq[key] = soft_ipq(scalp)
                save_webp(on_black(np.ones((*scalp.shape, 3), np.float32), scalp), os.path.join(out, f'{key}_alpha.webp'), EXPLORER_SIZE)

                colors = category @ CATEGORY_COLORS
                save_webp(on_black(colors, matte), os.path.join(out, f'{key}_categories.webp'), EXPLORER_SIZE)

                orientation = cv2.cvtColor(cv2.imread(os.path.join(pred_dir, '2d_orientation', f'{stem}.png'), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
                orientation[:, :, 2] = 0
                save_webp(on_black(orientation, matte), os.path.join(out, f'{key}_orientation.webp'), EXPLORER_SIZE)

                depth = cv2.imread(os.path.join(pred_dir, 'depth', f'{stem}.tiff'), cv2.IMREAD_UNCHANGED).astype(np.float32)
                valid = matte > 50 / 255
                lo, hi = depth[valid].min(), depth[valid].max()
                depth_rgb = cm.get_cmap('gnuplot2')(np.clip((depth - lo) / (hi - lo + 1e-8), 0, 1))[:, :, :3].astype(np.float32)
                save_webp(on_black(depth_rgb, matte), os.path.join(out, f'{key}_depth.webp'), EXPLORER_SIZE)
            else:
                sipq[key] = soft_ipq(matte)
                save_webp(on_black(np.ones((*matte.shape, 3), np.float32), matte), os.path.join(out, f'{key}_alpha.webp'), EXPLORER_SIZE)

        prompt = stem.split('_gs_')[0].strip()
        manifest['examples'].append({
            'slug': slug,
            'title': title,
            'prompt': prompt if prompt.endswith('.') else prompt + '…',
            'size': [image.shape[1], image.shape[0]],
            'zoom': zoom,
            'sipq': {k: round(v, 1) for k, v in sipq.items()},
        })

    path = os.path.join(OUT, 'explorer', 'manifest.js')
    with open(path, 'w') as f:
        f.write('window.EXPLORER = ' + json.dumps(manifest, indent=2, ensure_ascii=False) + ';\n')
    print(path)


if __name__ == '__main__':
    build_hero()
    build_wall()
    build_explorer()
