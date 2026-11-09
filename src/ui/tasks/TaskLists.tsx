import { useState, type KeyboardEvent } from 'react';
import type { TaskList } from '../../domain/types';

export const ALL_LISTS = 'all';

interface Props {
  lists: TaskList[];
  selected: string;
  onSelect(id: string): void;
  onCreate(name: string): void;
}

export function TaskLists({ lists, selected, onSelect, onCreate }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = name.trim();
      if (value) onCreate(value);
      setName('');
      setAdding(false);
    } else if (e.key === 'Escape') {
      setName('');
      setAdding(false);
    }
  }

  const tab = (id: string, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={selected === id}
      className="lists__tab"
      onClick={() => onSelect(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="lists">
      <div role="tablist" aria-label="Listat" className="lists__tabs">
        {tab(ALL_LISTS, 'Të gjitha')}
        {lists.map((l) => tab(l.id, l.name))}
      </div>
      {adding ? (
        <input
          autoFocus
          aria-label="Emri i listës"
          className="lists__input"
          placeholder="Emri i listës"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="lists__add" aria-label="Listë e re" onClick={() => setAdding(true)}>
          +
        </button>
      )}
    </div>
  );
}
