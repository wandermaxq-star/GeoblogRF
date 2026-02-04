import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import TextFormattingToolbar from './TextFormattingToolbar';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showToolbar?: boolean;
  className?: string;
}

const EditorWrapper = styled.div`
  border: 2px solid #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
`;

const EditorContent = styled.div`
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
  font-size: 1em;
  line-height: 1.6;
  color: #333;
  outline: none;
  
  /* Стили для форматированного контента */
  h1, h2, h3, h4, h5, h6 {
    margin: 16px 0 8px 0;
    font-weight: bold;
    color: #333;
  }
  
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1.1em; }
  h5 { font-size: 1em; }
  h6 { font-size: 0.9em; }
  
  p {
    margin: 8px 0;
  }
  
  ul, ol {
    margin: 8px 0;
    padding-left: 24px;
  }
  
  li {
    margin: 4px 0;
  }
  
  blockquote {
    margin: 16px 0;
    padding: 12px 16px;
    border-left: 4px solid #007bff;
    background: #f8f9fa;
    font-style: italic;
  }
  
  pre {
    margin: 16px 0;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 4px;
    overflow-x: auto;
    font-family: 'Courier New', monospace;
  }
  
  code {
    background: #f8f9fa;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }
  
  a {
    color: #007bff;
    text-decoration: underline;
    
    &:hover {
      color: #0056b3;
    }
  }
  
  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
  }
  
  hr {
    border: none;
    border-top: 2px solid #e9ecef;
    margin: 16px 0;
  }
  
  /* Стили для выравнивания */
  .text-left { text-align: left; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-justify { text-align: justify; }
`;

const Placeholder = styled.div`
  color: #6c757d;
  font-style: italic;
  pointer-events: none;
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1;
`;

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Начните писать...',
  disabled = false,
  showToolbar = true,
  className
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      onChange(content);
    }
  };

  const handleFormat = (format: string, value?: string) => {
    if (disabled) return;
    
    document.execCommand(format, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleInsert = (type: string) => {
    if (disabled) return;

    switch (type) {
      case 'link':
        const url = prompt('Введите URL ссылки:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
        break;
      case 'image':
        const imageUrl = prompt('Введите URL изображения:');
        if (imageUrl) {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.alt = 'Изображение';
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.style.borderRadius = '8px';
          img.style.margin = '8px 0';
          
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(img);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
        break;
      case 'separator':
        const hr = document.createElement('hr');
        hr.style.border = 'none';
        hr.style.borderTop = '2px solid #e9ecef';
        hr.style.margin = '16px 0';
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.insertNode(hr);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        break;
    }
    
    editorRef.current?.focus();
    handleInput();
  };

  const isFormatActive = (format: string): boolean => {
    if (disabled) return false;
    
    try {
      return document.queryCommandState(format);
    } catch {
      return false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Обработка горячих клавиш
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          handleFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          handleFormat('italic');
          break;
        case 'u':
          e.preventDefault();
          handleFormat('underline');
          break;
        case 'k':
          e.preventDefault();
          handleInsert('link');
          break;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <EditorWrapper className={className}>
      {showToolbar && (
        <TextFormattingToolbar
          onFormat={handleFormat}
          onInsert={handleInsert}
          isActive={isFormatActive}
          disabled={disabled}
        />
      )}
      
      <div style={{ position: 'relative' }}>
        <EditorContent
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          suppressContentEditableWarning={true}
          style={{
            minHeight: '200px',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '16px',
            fontSize: '1em',
            lineHeight: '1.6',
            color: '#333',
            outline: 'none'
          }}
        />
        
        {!value && !isFocused && (
          <Placeholder>{placeholder}</Placeholder>
        )}
      </div>
    </EditorWrapper>
  );
};

export default RichTextEditor;
