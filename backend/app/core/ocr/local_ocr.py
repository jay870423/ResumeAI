import pytesseract
from PIL import Image
from .base import BaseOCR


class LocalOCR(BaseOCR):
    """本地OCR（pytesseract）"""

    @property
    def name(self) -> str:
        return "pytesseract"

    def extract_text(self, image_path: str) -> str:
        """从图片提取文字"""
        img = Image.open(image_path)
        return pytesseract.image_to_string(img, lang="chi_sim+eng", config="--psm 6")
