import fitz  # PyMuPDF
from .base import BaseParser


class PDFParser(BaseParser):
    """PDF解析器"""

    @property
    def supported_extensions(self) -> list[str]:
        return [".pdf"]

    def extract_text(self, file_path: str) -> str:
        """提取PDF文本"""
        doc = fitz.open(file_path)
        texts = []
        for page in doc:
            text = page.get_text("text")
            if text.strip():
                texts.append(text)
        doc.close()
        return "\n".join(texts)
