import { useState, useCallback } from 'react';
import { cn } from '../../utils/cn';
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconDocument,
} from '../ui/Icons';

export interface TaxonomyNode {
  id: string;
  nome: string;
  count: number;
  children?: TaxonomyNode[];
}

export interface TaxonomyTreeProps {
  nodes: TaxonomyNode[];
  selectedNode: string | null;
  onNodeSelect: (nodeId: string, nodeName: string) => void;
  className?: string;
}

interface TreeNodeProps {
  node: TaxonomyNode;
  depth: number;
  selectedNode: string | null;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string, nodeName: string) => void;
}

function TreeNode({
  node,
  depth,
  selectedNode,
  expandedNodes,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNode === node.id;

  const handleClick = useCallback(() => {
    if (hasChildren) {
      onToggle(node.id);
    }
    onSelect(node.id, node.nome);
  }, [hasChildren, node.id, node.nome, onToggle, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <div className="taxonomy-node">
      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
          'hover:bg-gray-800/50',
          isSelected && 'bg-blue-500/20 text-blue-400',
          !isSelected && 'text-gray-300'
        )}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {/* Expand/collapse icon */}
        {hasChildren ? (
          <span className="text-gray-500 w-4 flex-shrink-0">
            {isExpanded ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Folder/file icon */}
        <span className={cn('flex-shrink-0', isSelected ? 'text-blue-400' : 'text-gray-500')}>
          {hasChildren ? <IconFolder size={16} /> : <IconDocument size={16} />}
        </span>

        {/* Node name */}
        <span className="flex-1 truncate text-sm">{node.nome}</span>

        {/* Question count badge */}
        {node.count > 0 && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              isSelected ? 'bg-blue-500/30 text-blue-300' : 'bg-gray-700 text-gray-400'
            )}
          >
            {node.count}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaxonomyTree({
  nodes,
  selectedNode,
  onNodeSelect,
  className,
}: TaxonomyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Start with all root nodes expanded
    return new Set(nodes.map((n) => n.id));
  });

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          'bg-gray-900 border border-gray-800 rounded-lg p-6 text-center',
          className
        )}
      >
        <p className="text-gray-500 text-sm">Nenhuma disciplina encontrada</p>
        <p className="text-gray-600 text-xs mt-1">
          Carregue provas para ver a distribuicao por disciplina
        </p>
      </div>
    );
  }

  return (
    <div
      role="tree"
      aria-label="Arvore de disciplinas"
      className={cn(
        'bg-gray-900 border border-gray-800 rounded-lg overflow-hidden',
        className
      )}
    >
      <div className="max-h-[400px] overflow-y-auto scrollbar-custom py-2">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            selectedNode={selectedNode}
            expandedNodes={expandedNodes}
            onToggle={handleToggle}
            onSelect={onNodeSelect}
          />
        ))}
      </div>
    </div>
  );
}
