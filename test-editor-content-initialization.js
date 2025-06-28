/**
 * Test script to verify that the editor content initialization doesn't add unwanted spaces
 * Run this in the browser console on a new page creation
 */

async function testEditorContentInitialization() {
  console.log('🧪 Testing Editor Content Initialization...');
  
  try {
    // Test 1: Check if empty content structure is correct
    console.log('\n1. Testing empty content structure...');
    
    const emptyContent = [{ type: "paragraph", children: [{ text: "" }] }];
    console.log('Empty content structure:', JSON.stringify(emptyContent, null, 2));
    
    // Check if the text property is truly empty
    const textContent = emptyContent[0].children[0].text;
    console.log('Text content:', JSON.stringify(textContent));
    console.log('Text length:', textContent.length);
    console.log('Text has leading space:', textContent.startsWith(' '));
    console.log('Text has trailing space:', textContent.endsWith(' '));
    
    // Test 2: Check HTML conversion
    console.log('\n2. Testing HTML conversion...');
    
    // Simulate the convertSlateToHTML function behavior
    function testConvertSlateToHTML(slateContent) {
      if (!slateContent || !Array.isArray(slateContent)) {
        return "<div><br></div>";
      }
      
      let result = "";
      
      for (let paragraphIndex = 0; paragraphIndex < slateContent.length; paragraphIndex++) {
        const node = slateContent[paragraphIndex];
        if (node.type === "paragraph" && node.children) {
          result += "<div>";
          let hasContent = false;
          
          for (const child of node.children) {
            if (child.text !== undefined) {
              if (child.text === "") {
                // Don't add &nbsp; for empty text - let the div remain empty
                // This prevents the browser from converting &nbsp; to a space when user starts typing
              } else {
                result += child.text.replace(/\n/g, '<br>');
                hasContent = true;
              }
            }
          }
          
          if (!hasContent) {
            result += "<br>";
          }
          
          result += "</div>";
        }
      }
      
      return result || "<div><br></div>";
    }
    
    const htmlContent = testConvertSlateToHTML(emptyContent);
    console.log('HTML content:', htmlContent);
    console.log('HTML contains &nbsp;:', htmlContent.includes('&nbsp;'));
    console.log('HTML contains <br>:', htmlContent.includes('<br>'));
    
    // Test 3: Check HTML to Slate conversion
    console.log('\n3. Testing HTML to Slate conversion...');
    
    // Simulate the convertHTMLToSlate function behavior for empty content
    function testConvertHTMLToSlate(html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const result = [];
      const children = Array.from(tempDiv.children);
      
      const contentDivs = children.filter(child => 
        child.tagName === 'DIV' && !child.classList?.contains('unified-paragraph-number')
      );
      
      if (contentDivs.length === 0) {
        return [{ type: "paragraph", children: [{ text: "" }] }];
      }
      
      contentDivs.forEach((div) => {
        const paragraph = {
          type: "paragraph",
          children: []
        };
        
        const processNode = (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || "";
            // Handle &nbsp; as empty content for proper contentEditable behavior
            if (text && text !== '\u00A0') { // \u00A0 is the non-breaking space character
              paragraph.children.push({ text });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            
            if (element.tagName === 'BR') {
              if (paragraph.children.length === 0) {
                paragraph.children.push({ text: "" });
              }
              return;
            }
          }
        };
        
        // Process all child nodes
        div.childNodes.forEach(processNode);
        
        // Ensure paragraph has at least one child
        if (paragraph.children.length === 0) {
          paragraph.children.push({ text: "" });
        }
        
        result.push(paragraph);
      });
      
      return result.length > 0 ? result : [{ type: "paragraph", children: [{ text: "" }] }];
    }
    
    const convertedBack = testConvertHTMLToSlate(htmlContent);
    console.log('Converted back to Slate:', JSON.stringify(convertedBack, null, 2));
    
    // Check if the round-trip conversion preserves empty content
    const finalTextContent = convertedBack[0].children[0].text;
    console.log('Final text content:', JSON.stringify(finalTextContent));
    console.log('Final text length:', finalTextContent.length);
    console.log('Final text has leading space:', finalTextContent.startsWith(' '));
    
    // Test 4: Check actual editor behavior if available
    console.log('\n4. Testing actual editor behavior...');
    
    const editorElement = document.querySelector('[contenteditable="true"]');
    if (editorElement) {
      console.log('Found editor element');
      console.log('Editor innerHTML:', editorElement.innerHTML);
      console.log('Editor textContent:', JSON.stringify(editorElement.textContent));
      console.log('Editor textContent length:', editorElement.textContent.length);
      console.log('Editor has leading space:', editorElement.textContent.startsWith(' '));
      
      // Check if the editor contains &nbsp;
      console.log('Editor contains &nbsp;:', editorElement.innerHTML.includes('&nbsp;'));
      console.log('Editor contains <br>:', editorElement.innerHTML.includes('<br>'));
    } else {
      console.log('No editor element found');
    }
    
    console.log('\n✅ Editor content initialization test completed');
    
    return {
      success: true,
      emptyContentCorrect: textContent === "",
      htmlUsesBreaks: htmlContent.includes('<br>') && !htmlContent.includes('&nbsp;'),
      roundTripCorrect: finalTextContent === "",
      editorCorrect: editorElement ? !editorElement.textContent.startsWith(' ') : null
    };
    
  } catch (error) {
    console.error('❌ Editor content initialization test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Auto-run the test if this script is loaded
if (typeof window !== 'undefined') {
  // Wait a moment for the page to load
  setTimeout(() => {
    testEditorContentInitialization().then(result => {
      console.log('\n📊 Test Results:', result);
    });
  }, 1000);
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testEditorContentInitialization };
}
