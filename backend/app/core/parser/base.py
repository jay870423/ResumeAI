from abc import ABC, abstractmethod


class BaseParser(ABC):
    """解析器基类"""

    @abstractmethod
    def extract_text(self, file_path: str) -> str:
        """从文件中提取纯文本"""
        pass

    @property
    @abstractmethod
    def supported_extensions(self) -> list[str]:
        """支持的扩展名"""
        pass
