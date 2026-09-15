import os
import re
import win32com.client

from backend import config


def ppt_to_images(ppt_path: str, output_dir: str):
    ppt_name = os.path.splitext(os.path.basename(ppt_path))[0]
    save_dir = os.path.join(output_dir, ppt_name)
    os.makedirs(save_dir, exist_ok=True)

    powerpoint = win32com.client.DispatchEx("PowerPoint.Application")
    presentation = powerpoint.Presentations.Open(
        os.path.abspath(ppt_path),
        WithWindow=False
    )

    try:
        presentation.Export(save_dir, "PNG")
    finally:
        presentation.Close()
        powerpoint.Quit()

    files = [
        f for f in os.listdir(save_dir)
        if f.lower().endswith(".png")
    ]

    files.sort(
        key=lambda f: int(re.search(r"\d+", f).group())
    )

    image_paths = []

    for i, file in enumerate(files, 1):
        old_path = os.path.join(save_dir, file)
        new_path = os.path.join(save_dir, f"page_{i}.png")

        if old_path != new_path:
            os.rename(old_path, new_path)

        image_paths.append(new_path)

    return image_paths

if __name__ == "__main__":
    ppt_path = r"C:\Users\shen.xin\Downloads\AI&财务\test\test.pptx"
    images = ppt_to_images(ppt_path, config.DOWNLOAD_DIR)


    print(images)