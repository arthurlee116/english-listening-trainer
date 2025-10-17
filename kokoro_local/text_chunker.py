#!/usr/bin/env python3
"""
Kokoro TTS Text Chunking Module
智能文本分块模块，用于将长文本分割为适合 TTS 合成的小块
"""

import re
import textwrap
from typing import List

# Kokoro phoneme 限制，保持 chunk 大小较小
MAX_CHUNK_CHAR_SIZE = 100


def split_text_intelligently(text: str, max_chunk_size: int = MAX_CHUNK_CHAR_SIZE) -> List[str]:
    """
    智能分割文本，优先在句子边界分割

    Args:
        text: 待分割的文本
        max_chunk_size: 每个 chunk 的最大字符数

    Returns:
        分割后的文本块列表
    """
    chunks = []

    # 先按段落分割
    paragraphs = text.split('\n\n')
    current_chunk = ""

    for paragraph in paragraphs:
        # 如果当前块加上新段落不会太长，就添加
        if len(current_chunk + paragraph) <= max_chunk_size:
            current_chunk += paragraph + "\n\n"
        else:
            # 如果当前块不为空，先保存
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # 如果单个段落太长，需要进一步分割
            if len(paragraph) > max_chunk_size:
                sentences = split_by_sentences(paragraph, max_chunk_size)
                chunks.extend(sentences)
            else:
                current_chunk = paragraph + "\n\n"

    # 添加最后一个块
    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    normalized_chunks: List[str] = []
    for chunk in chunks:
        cleaned = chunk.strip()
        if not cleaned:
            continue
        if len(cleaned) <= max_chunk_size:
            normalized_chunks.append(cleaned)
        else:
            normalized_chunks.extend(chunk_by_words(cleaned, max_chunk_size))

    return normalized_chunks


def split_by_sentences(text: str, max_chunk_size: int = MAX_CHUNK_CHAR_SIZE) -> List[str]:
    """
    按句子分割文本

    Args:
        text: 待分割的文本
        max_chunk_size: 每个 chunk 的最大字符数

    Returns:
        分割后的文本块列表
    """
    # 按句子分割（句号、问号、感叹号）
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk + sentence) <= max_chunk_size:
            current_chunk += sentence + " "
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # 如果单个句子太长，按逗号分割
            if len(sentence) > max_chunk_size:
                sub_chunks = split_by_commas(sentence, max_chunk_size)
                chunks.extend(sub_chunks)
            else:
                current_chunk = sentence + " "

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def split_by_commas(text: str, max_chunk_size: int = MAX_CHUNK_CHAR_SIZE) -> List[str]:
    """
    按逗号分割文本

    Args:
        text: 待分割的文本
        max_chunk_size: 每个 chunk 的最大字符数

    Returns:
        分割后的文本块列表
    """
    parts = text.split(', ')
    chunks = []
    current_chunk = ""

    for part in parts:
        if len(current_chunk + part) <= max_chunk_size:
            current_chunk += part + ", "
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.rstrip(', '))
                current_chunk = ""

            # 如果单个部分还是太长，强制分割
            if len(part) > max_chunk_size:
                sub_chunks = chunk_by_words(part, max_chunk_size)
                if sub_chunks:
                    chunks.extend(sub_chunks[:-1])
                    last_chunk = sub_chunks[-1]
                    current_chunk = (last_chunk + ", ") if last_chunk else ""
                else:
                    current_chunk = ""
            else:
                current_chunk = part + ", "

    if current_chunk.strip():
        chunks.append(current_chunk.rstrip(', '))

    return chunks


def chunk_by_words(text: str, max_chunk_size: int = MAX_CHUNK_CHAR_SIZE) -> List[str]:
    """确保在单词边界进行硬分割的兜底策略"""
    normalized = text.strip()
    if not normalized:
        return []

    if len(normalized) <= max_chunk_size:
        return [normalized]

    wrapped = textwrap.wrap(
        normalized,
        max_chunk_size,
        break_long_words=False,
        break_on_hyphens=False,
    )

    if wrapped:
        chunks = [chunk.strip() for chunk in wrapped if chunk.strip()]
        if chunks:
            return chunks

    # 仍然存在超长连续字符串（如URL），退回到字符级别切分
    return [
        normalized[i:i + max_chunk_size]
        for i in range(0, len(normalized), max_chunk_size)
    ]
