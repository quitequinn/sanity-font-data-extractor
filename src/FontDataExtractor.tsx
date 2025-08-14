import React, { useState, useCallback } from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Select,
  Stack,
  Text,
  TextArea,
  TextInput,
  Checkbox,
  Badge,
  Spinner,
  Code
} from '@sanity/ui'
import { DownloadIcon, SearchIcon, DocumentTextIcon } from '@sanity/icons'
import { SanityClient } from 'sanity'

export interface FontDataExtractorProps {
  client: SanityClient
  documentTypes?: string[]
  onComplete?: (results: ExtractionResult) => void
  onError?: (error: string) => void
  maxDocuments?: number
}

export interface FontData {
  fontFamily: string
  fontSize?: string
  fontWeight?: string
  fontStyle?: string
  lineHeight?: string
  letterSpacing?: string
  textTransform?: string
  textDecoration?: string
  color?: string
  usage: {
    documentId: string
    documentType: string
    fieldPath: string
    content: string
  }[]
}

export interface ExtractionResult {
  totalDocuments: number
  fontsFound: FontData[]
  errors: string[]
  summary: {
    uniqueFonts: number
    totalUsages: number
    mostUsedFont: string
  }
}

const FontDataExtractor: React.FC<FontDataExtractorProps> = ({
  client,
  documentTypes = [],
  onComplete,
  onError,
  maxDocuments = 1000
}) => {
  const [selectedType, setSelectedType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [useCustomQuery, setUseCustomQuery] = useState(false)
  const [customGroqQuery, setCustomGroqQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
  const [message, setMessage] = useState('')
  const [includeInlineStyles, setIncludeInlineStyles] = useState(true)
  const [includeCSSClasses, setIncludeCSSClasses] = useState(true)
  const [extractFromRichText, setExtractFromRichText] = useState(true)
  const [fieldsToAnalyze, setFieldsToAnalyze] = useState('title,heading,content,description,text')

  const extractFontFromStyle = (styleString: string): Partial<FontData> => {
    const fontData: Partial<FontData> = {}
    
    // Extract font-family
    const fontFamilyMatch = styleString.match(/font-family:\s*([^;]+)/i)
    if (fontFamilyMatch) {
      fontData.fontFamily = fontFamilyMatch[1].replace(/["']/g, '').trim()
    }
    
    // Extract font-size
    const fontSizeMatch = styleString.match(/font-size:\s*([^;]+)/i)
    if (fontSizeMatch) {
      fontData.fontSize = fontSizeMatch[1].trim()
    }
    
    // Extract font-weight
    const fontWeightMatch = styleString.match(/font-weight:\s*([^;]+)/i)
    if (fontWeightMatch) {
      fontData.fontWeight = fontWeightMatch[1].trim()
    }
    
    // Extract font-style
    const fontStyleMatch = styleString.match(/font-style:\s*([^;]+)/i)
    if (fontStyleMatch) {
      fontData.fontStyle = fontStyleMatch[1].trim()
    }
    
    // Extract line-height
    const lineHeightMatch = styleString.match(/line-height:\s*([^;]+)/i)
    if (lineHeightMatch) {
      fontData.lineHeight = lineHeightMatch[1].trim()
    }
    
    // Extract letter-spacing
    const letterSpacingMatch = styleString.match(/letter-spacing:\s*([^;]+)/i)
    if (letterSpacingMatch) {
      fontData.letterSpacing = letterSpacingMatch[1].trim()
    }
    
    // Extract text-transform
    const textTransformMatch = styleString.match(/text-transform:\s*([^;]+)/i)
    if (textTransformMatch) {
      fontData.textTransform = textTransformMatch[1].trim()
    }
    
    // Extract text-decoration
    const textDecorationMatch = styleString.match(/text-decoration:\s*([^;]+)/i)
    if (textDecorationMatch) {
      fontData.textDecoration = textDecorationMatch[1].trim()
    }
    
    // Extract color
    const colorMatch = styleString.match(/color:\s*([^;]+)/i)
    if (colorMatch) {
      fontData.color = colorMatch[1].trim()
    }
    
    return fontData
  }

  const extractFontFromClassName = (className: string): Partial<FontData> => {
    const fontData: Partial<FontData> = {}
    
    // Common font family patterns in class names
    const fontFamilyPatterns = [
      /font-([a-zA-Z-]+)/,
      /family-([a-zA-Z-]+)/,
      /(serif|sans-serif|monospace|cursive|fantasy)/,
      /(arial|helvetica|times|georgia|verdana|courier)/i
    ]
    
    for (const pattern of fontFamilyPatterns) {
      const match = className.match(pattern)
      if (match) {
        fontData.fontFamily = match[1].replace(/-/g, ' ')
        break
      }
    }
    
    // Font size patterns
    const fontSizeMatch = className.match(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)/)
    if (fontSizeMatch) {
      fontData.fontSize = fontSizeMatch[1]
    }
    
    // Font weight patterns
    const fontWeightMatch = className.match(/font-(thin|light|normal|medium|semibold|bold|extrabold|black)/)
    if (fontWeightMatch) {
      fontData.fontWeight = fontWeightMatch[1]
    }
    
    return fontData
  }

  const analyzeDocument = (doc: any, path = ''): FontData[] => {
    const fonts: FontData[] = []
    const fieldsArray = fieldsToAnalyze.split(',').map(f => f.trim())
    
    const analyzeValue = (value: any, currentPath: string) => {
      if (!value) return
      
      if (typeof value === 'string') {
        // Check if this field should be analyzed
        const fieldName = currentPath.split('.').pop() || ''
        if (fieldsArray.length === 0 || fieldsArray.some(field => fieldName.toLowerCase().includes(field.toLowerCase()))) {
          // Look for inline styles
          if (includeInlineStyles) {
            const styleMatches = value.match(/style=["']([^"']*)["']/g)
            if (styleMatches) {
              styleMatches.forEach(styleMatch => {
                const styleContent = styleMatch.match(/style=["']([^"']*)["']/)?.[1]
                if (styleContent) {
                  const fontData = extractFontFromStyle(styleContent)
                  if (fontData.fontFamily) {
                    const existingFont = fonts.find(f => f.fontFamily === fontData.fontFamily)
                    if (existingFont) {
                      existingFont.usage.push({
                        documentId: doc._id,
                        documentType: doc._type,
                        fieldPath: currentPath,
                        content: value.substring(0, 100) + (value.length > 100 ? '...' : '')
                      })
                    } else {
                      fonts.push({
                        ...fontData,
                        fontFamily: fontData.fontFamily!,
                        usage: [{
                          documentId: doc._id,
                          documentType: doc._type,
                          fieldPath: currentPath,
                          content: value.substring(0, 100) + (value.length > 100 ? '...' : '')
                        }]
                      })
                    }
                  }
                }
              })
            }
          }
          
          // Look for CSS classes
          if (includeCSSClasses) {
            const classMatches = value.match(/class=["']([^"']*)["']/g)
            if (classMatches) {
              classMatches.forEach(classMatch => {
                const classContent = classMatch.match(/class=["']([^"']*)["']/)?.[1]
                if (classContent) {
                  const fontData = extractFontFromClassName(classContent)
                  if (fontData.fontFamily) {
                    const existingFont = fonts.find(f => f.fontFamily === fontData.fontFamily)
                    if (existingFont) {
                      existingFont.usage.push({
                        documentId: doc._id,
                        documentType: doc._type,
                        fieldPath: currentPath,
                        content: value.substring(0, 100) + (value.length > 100 ? '...' : '')
                      })
                    } else {
                      fonts.push({
                        ...fontData,
                        fontFamily: fontData.fontFamily!,
                        usage: [{
                          documentId: doc._id,
                          documentType: doc._type,
                          fieldPath: currentPath,
                          content: value.substring(0, 100) + (value.length > 100 ? '...' : '')
                        }]
                      })
                    }
                  }
                }
              })
            }
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          analyzeValue(item, `${currentPath}[${index}]`)
        })
      } else if (value && typeof value === 'object') {
        // Handle rich text blocks
        if (extractFromRichText && value._type === 'block') {
          if (value.style) {
            // Map common rich text styles to font properties
            const styleMap: Record<string, Partial<FontData>> = {
              'h1': { fontFamily: 'heading', fontSize: '2xl', fontWeight: 'bold' },
              'h2': { fontFamily: 'heading', fontSize: 'xl', fontWeight: 'bold' },
              'h3': { fontFamily: 'heading', fontSize: 'lg', fontWeight: 'semibold' },
              'h4': { fontFamily: 'heading', fontSize: 'md', fontWeight: 'semibold' },
              'h5': { fontFamily: 'heading', fontSize: 'sm', fontWeight: 'medium' },
              'h6': { fontFamily: 'heading', fontSize: 'xs', fontWeight: 'medium' },
              'blockquote': { fontFamily: 'serif', fontStyle: 'italic' },
              'normal': { fontFamily: 'body', fontSize: 'base' }
            }
            
            const styleData = styleMap[value.style]
            if (styleData && styleData.fontFamily) {
              const existingFont = fonts.find(f => f.fontFamily === styleData.fontFamily)
              const content = value.children?.map((child: any) => child.text).join('') || ''
              
              if (existingFont) {
                existingFont.usage.push({
                  documentId: doc._id,
                  documentType: doc._type,
                  fieldPath: `${currentPath}.style`,
                  content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
                })
              } else {
                fonts.push({
                  ...styleData,
                  fontFamily: styleData.fontFamily!,
                  usage: [{
                    documentId: doc._id,
                    documentType: doc._type,
                    fieldPath: `${currentPath}.style`,
                    content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
                  }]
                })
              }
            }
          }
          
          // Analyze marks (bold, italic, etc.)
          if (value.children) {
            value.children.forEach((child: any, childIndex: number) => {
              if (child.marks) {
                child.marks.forEach((mark: string) => {
                  const markData: Partial<FontData> = {}
                  
                  switch (mark) {
                    case 'strong':
                      markData.fontWeight = 'bold'
                      markData.fontFamily = 'body-bold'
                      break
                    case 'em':
                      markData.fontStyle = 'italic'
                      markData.fontFamily = 'body-italic'
                      break
                    case 'underline':
                      markData.textDecoration = 'underline'
                      markData.fontFamily = 'body-underline'
                      break
                  }
                  
                  if (markData.fontFamily) {
                    const existingFont = fonts.find(f => f.fontFamily === markData.fontFamily)
                    if (existingFont) {
                      existingFont.usage.push({
                        documentId: doc._id,
                        documentType: doc._type,
                        fieldPath: `${currentPath}.children[${childIndex}].marks`,
                        content: child.text || ''
                      })
                    } else {
                      fonts.push({
                        ...markData,
                        fontFamily: markData.fontFamily!,
                        usage: [{
                          documentId: doc._id,
                          documentType: doc._type,
                          fieldPath: `${currentPath}.children[${childIndex}].marks`,
                          content: child.text || ''
                        }]
                      })
                    }
                  }
                })
              }
            })
          }
        } else {
          // Regular object traversal
          Object.keys(value).forEach(key => {
            if (!key.startsWith('_')) { // Skip system fields
              analyzeValue(value[key], currentPath ? `${currentPath}.${key}` : key)
            }
          })
        }
      }
    }
    
    analyzeValue(doc, '')
    return fonts
  }

  const extractFontData = useCallback(async () => {
    if (!client) return
    
    setIsLoading(true)
    setMessage('Extracting font data from documents...')
    
    try {
      let query = ''
      
      if (useCustomQuery && customGroqQuery) {
        query = customGroqQuery
      } else {
        const typeFilter = selectedType ? `_type == "${selectedType}"` : 'defined(_type)'
        const searchFilter = searchQuery ? ` && (title match "*${searchQuery}*" || name match "*${searchQuery}*")` : ''
        query = `*[${typeFilter}${searchFilter}][0...${maxDocuments}]`
      }
      
      const documents = await client.fetch(query)
      setMessage(`Analyzing ${documents.length} documents for font data...`)
      
      const allFonts: FontData[] = []
      const errors: string[] = []
      
      documents.forEach((doc: any) => {
        try {
          const documentFonts = analyzeDocument(doc)
          
          // Merge fonts with existing ones
          documentFonts.forEach(newFont => {
            const existingFont = allFonts.find(f => 
              f.fontFamily === newFont.fontFamily &&
              f.fontSize === newFont.fontSize &&
              f.fontWeight === newFont.fontWeight &&
              f.fontStyle === newFont.fontStyle
            )
            
            if (existingFont) {
              existingFont.usage.push(...newFont.usage)
            } else {
              allFonts.push(newFont)
            }
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
          errors.push(`Failed to analyze ${doc._id}: ${errorMessage}`)
        }
      })
      
      // Generate summary
      const uniqueFonts = allFonts.length
      const totalUsages = allFonts.reduce((sum, font) => sum + font.usage.length, 0)
      const mostUsedFont = allFonts.reduce((prev, current) => 
        prev.usage.length > current.usage.length ? prev : current
      )?.fontFamily || 'None'
      
      const result: ExtractionResult = {
        totalDocuments: documents.length,
        fontsFound: allFonts,
        errors,
        summary: {
          uniqueFonts,
          totalUsages,
          mostUsedFont
        }
      }
      
      setExtractionResult(result)
      setMessage(`Extraction complete: Found ${uniqueFonts} unique fonts in ${totalUsages} usages`)
      onComplete?.(result)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Extraction failed'
      setMessage(`Extraction error: ${errorMessage}`)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [client, selectedType, searchQuery, useCustomQuery, customGroqQuery, maxDocuments, includeInlineStyles, includeCSSClasses, extractFromRichText, fieldsToAnalyze, onComplete, onError])

  const exportResults = () => {
    if (!extractionResult) return
    
    const exportData = {
      summary: extractionResult.summary,
      fonts: extractionResult.fontsFound.map(font => ({
        fontFamily: font.fontFamily,
        fontSize: font.fontSize,
        fontWeight: font.fontWeight,
        fontStyle: font.fontStyle,
        lineHeight: font.lineHeight,
        letterSpacing: font.letterSpacing,
        textTransform: font.textTransform,
        textDecoration: font.textDecoration,
        color: font.color,
        usageCount: font.usage.length,
        usages: font.usage
      }))
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `font-data-extraction-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card padding={4}>
      <Stack space={4}>
        <Heading size={2}>Font Data Extractor</Heading>
        
        <Text size={1} muted>
          Extract and analyze font usage from documents with detailed typography information.
        </Text>

        {/* Document Type Selection */}
        <Stack space={2}>
          <Text weight="semibold">Document Type</Text>
          <Select
            value={selectedType}
            onChange={(event) => setSelectedType(event.currentTarget.value)}
          >
            <option value="">All document types</option>
            {documentTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        </Stack>

        {/* Extraction Configuration */}
        <Card padding={3} tone="primary">
          <Stack space={3}>
            <Text weight="semibold">Extraction Configuration</Text>
            
            <Stack space={2}>
              <Text size={1} weight="medium">Fields to Analyze</Text>
              <TextInput
                placeholder="Comma-separated field names (e.g., title,heading,content)"
                value={fieldsToAnalyze}
                onChange={(event) => setFieldsToAnalyze(event.currentTarget.value)}
              />
              <Text size={1} muted>
                Only fields containing these names will be analyzed for font data
              </Text>
            </Stack>
            
            <Flex gap={3} wrap="wrap">
              <Checkbox
                checked={includeInlineStyles}
                onChange={(event) => setIncludeInlineStyles(event.currentTarget.checked)}
              >
                Extract from inline styles
              </Checkbox>
              
              <Checkbox
                checked={includeCSSClasses}
                onChange={(event) => setIncludeCSSClasses(event.currentTarget.checked)}
              >
                Extract from CSS classes
              </Checkbox>
              
              <Checkbox
                checked={extractFromRichText}
                onChange={(event) => setExtractFromRichText(event.currentTarget.checked)}
              >
                Extract from rich text blocks
              </Checkbox>
            </Flex>
          </Stack>
        </Card>

        {/* Search Configuration */}
        <Stack space={3}>
          <Text weight="semibold">Search Configuration</Text>
          
          <Checkbox
            checked={useCustomQuery}
            onChange={(event) => setUseCustomQuery(event.currentTarget.checked)}
          >
            Use custom GROQ query
          </Checkbox>
          
          {useCustomQuery ? (
            <TextArea
              placeholder="Enter GROQ query (e.g., *[_type == 'post' && defined(content)])..."
              value={customGroqQuery}
              onChange={(event) => setCustomGroqQuery(event.currentTarget.value)}
              rows={3}
            />
          ) : (
            <TextInput
              placeholder="Search in title, name, or other fields..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              onKeyPress={(event) => event.key === 'Enter' && extractFontData()}
            />
          )}
          
          <Button
            text="Extract Font Data"
            onClick={extractFontData}
            disabled={isLoading}
            tone="primary"
            icon={SearchIcon}
          />
        </Stack>

        {/* Results */}
        {extractionResult && (
          <Card padding={3} tone="transparent">
            <Stack space={4}>
              <Flex align="center" justify="space-between">
                <Text weight="semibold">Extraction Results</Text>
                <Button
                  text="Export Results"
                  onClick={exportResults}
                  icon={DownloadIcon}
                  mode="ghost"
                />
              </Flex>
              
              {/* Summary */}
              <Card padding={3} tone="positive">
                <Stack space={2}>
                  <Text weight="semibold" size={1}>Summary</Text>
                  <Flex gap={4} wrap="wrap">
                    <Badge tone="primary">Documents: {extractionResult.totalDocuments}</Badge>
                    <Badge tone="positive">Unique Fonts: {extractionResult.summary.uniqueFonts}</Badge>
                    <Badge tone="caution">Total Usages: {extractionResult.summary.totalUsages}</Badge>
                  </Flex>
                  <Text size={1} muted>
                    Most used font: <strong>{extractionResult.summary.mostUsedFont}</strong>
                  </Text>
                </Stack>
              </Card>
              
              {/* Font List */}
              <Box style={{ maxHeight: '400px', overflow: 'auto' }}>
                <Stack space={2}>
                  {extractionResult.fontsFound.slice(0, 20).map((font, index) => (
                    <Card key={index} padding={3} tone="default">
                      <Stack space={2}>
                        <Flex justify="space-between" align="center">
                          <Text weight="semibold">{font.fontFamily}</Text>
                          <Badge tone="primary">{font.usage.length} usages</Badge>
                        </Flex>
                        
                        <Flex gap={2} wrap="wrap">
                          {font.fontSize && <Code size={1}>size: {font.fontSize}</Code>}
                          {font.fontWeight && <Code size={1}>weight: {font.fontWeight}</Code>}
                          {font.fontStyle && <Code size={1}>style: {font.fontStyle}</Code>}
                          {font.lineHeight && <Code size={1}>line-height: {font.lineHeight}</Code>}
                          {font.color && <Code size={1}>color: {font.color}</Code>}
                        </Flex>
                        
                        <Text size={1} muted>
                          Used in: {font.usage.map(u => u.documentType).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                        </Text>
                      </Stack>
                    </Card>
                  ))}
                  {extractionResult.fontsFound.length > 20 && (
                    <Text size={1} muted>...and {extractionResult.fontsFound.length - 20} more fonts</Text>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Card>
        )}

        {/* Status */}
        {(isLoading || message) && (
          <Card padding={3} tone={isLoading ? 'primary' : 'positive'}>
            <Flex align="center" gap={2}>
              {isLoading && <Spinner />}
              <Text>{message}</Text>
            </Flex>
          </Card>
        )}

        {/* Settings */}
        <Card padding={3} tone="transparent">
          <Stack space={2}>
            <Text weight="semibold" size={1}>Settings</Text>
            <Text size={1} muted>Max documents: {maxDocuments}</Text>
          </Stack>
        </Card>

        {/* Info */}
        <Card padding={3} tone="transparent">
          <Stack space={2}>
            <Text weight="semibold" size={1}>Font Extraction Sources</Text>
            <Text size={1} muted>
              • Inline CSS styles (style attributes)
            </Text>
            <Text size={1} muted>
              • CSS class names (common font patterns)
            </Text>
            <Text size={1} muted>
              • Rich text block styles (headings, emphasis)
            </Text>
            <Text size={1} muted>
              • Text formatting marks (bold, italic, underline)
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Card>
  )
}

export default FontDataExtractor