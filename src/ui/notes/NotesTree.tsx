import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { TreeNode } from '../../domain/notesTree';

interface Props {
  nodes: TreeNode[];
  selectedId: string | null;
  expanded: Set<string>;
  onToggle(id: string): void;
  onSelect(id: string): void;
  onAddChild(parentId: string | null): void;
}

function Row({ node, level, ...p }: Props & { node: TreeNode; level: number }) {
  const drag = useDraggable({ id: node.id });
  const drop = useDroppable({ id: node.id });
  const hasChildren = node.children.length > 0;
  const open = p.expanded.has(node.id);
  const title = node.title.trim() || 'Pa titull';
  const classes = ['tree__row'];
  if (p.selectedId === node.id) classes.push('is-selected');
  if (drop.isOver) classes.push('is-over');
  if (drag.isDragging) classes.push('is-dragging');
  return (
    <li role="treeitem" aria-level={level} aria-expanded={hasChildren ? open : undefined} aria-selected={p.selectedId === node.id}>
      <div
        ref={(el) => {
          drag.setNodeRef(el);
          drop.setNodeRef(el);
        }}
        className={classes.join(' ')}
        style={{ paddingLeft: 4 + (level - 1) * 16 }}
        {...drag.attributes}
        {...drag.listeners}
      >
        <button
          type="button"
          className="tree__chevron"
          aria-label={open ? `Mbyll ${title}` : `Hap ${title}`}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          onClick={() => p.onToggle(node.id)}
        >
          {open ? '▾' : '▸'}
        </button>
        <button type="button" className="tree__title" onClick={() => p.onSelect(node.id)}>
          <span aria-hidden="true">{node.icon ?? (hasChildren ? '📁' : '📄')}</span> {title}
        </button>
        <button type="button" className="tree__add" aria-label={`Shto nën-shënim te ${title}`} onClick={() => p.onAddChild(node.id)}>
          +
        </button>
      </div>
      {hasChildren && open && (
        <ul role="group">
          {node.children.map((c) => (
            <Row key={c.id} {...p} nodes={p.nodes} node={c} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function NotesTree(props: Props) {
  const rootDrop = useDroppable({ id: 'root' });
  return (
    <div className="tree">
      <ul role="tree" aria-label="Shënimet" className="tree__list">
        {props.nodes.map((n) => (
          <Row key={n.id} {...props} node={n} level={1} />
        ))}
      </ul>
      <div ref={rootDrop.setNodeRef} className={`tree__root-drop${rootDrop.isOver ? ' is-over' : ''}`}>
        <button type="button" className="tree__new" onClick={() => props.onAddChild(null)}>
          Shënim i ri
        </button>
      </div>
    </div>
  );
}
