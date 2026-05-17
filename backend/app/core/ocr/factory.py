from app.core.config import settings
from .base import BaseOCR
from .local_ocr import LocalOCR
from .aliyun_ocr import AliyunOCR


class OCRFactory:
    """OCR工厂，根据配置选择实现"""

    def __init__(self):
        if settings.aliyun_ocr_api_key:
            self._ocr: BaseOCR = AliyunOCR(
                api_key=settings.aliyun_ocr_api_key,
                api_secret=settings.aliyun_ocr_api_secret,
            )
        else:
            self._ocr = LocalOCR()

    @property
    def ocr(self) -> BaseOCR:
        return self._ocr

    def extract_text(self, image_path: str) -> str:
        """提取图片文字"""
        return self._ocr.extract_text(image_path)
