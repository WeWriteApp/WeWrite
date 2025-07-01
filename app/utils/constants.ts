// Type definitions for Slate editor node types
export interface NodeTypes {
  readonly PARAGRAPH: 'paragraph';
  readonly HEADING: 'heading';
  readonly CODE_BLOCK: 'code-block';
  readonly LIST: 'list';
  readonly LIST_ITEM: 'list-item';
  readonly LINK: 'link';
}

// Node type constants for Slate editor
export const nodeTypes: NodeTypes = {
  PARAGRAPH: 'paragraph',
  HEADING: 'heading',
  CODE_BLOCK: 'code-block',
  LIST: 'list',
  LIST_ITEM: 'list-item',
  LINK: 'link'} as const;

// Type for individual node type values
export type NodeType = NodeTypes[keyof NodeTypes];