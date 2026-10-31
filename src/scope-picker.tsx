import { ChevronRight, TriangleAlert } from 'lucide-react';
import * as React from 'react';

import type { ApiCredentialScope } from './api-credentials-section';
import { resolveAuthComponents } from './components';
import {
  closeImplications,
  inCatalogOrder,
  neededBy,
  restrictImplications,
  sameSelection,
  withScopes,
  withoutScopes,
  type ScopeImplications,
} from './scope-selection';
import type { AuthComponentInput } from './types';

/** A named set of related scopes (`scopes` are ids from the sibling scope list). */
export interface ApiCredentialScopeGroup {
  id: string;
  label: string;
  description: string | null;
  /** A sensitive group is one parent checkbox, with its scopes behind a disclosure. */
  sensitive: boolean;
  scopes: string[];
}

/** A one-click selection: choosing it replaces the selection with exactly `scopes`. */
export interface ApiCredentialScopePreset {
  id: string;
  label: string;
  description: string;
  scopes: string[];
}

export interface ScopePickerProps {
  idPrefix: string;
  scopes: ApiCredentialScope[];
  /** Absent or empty: a flat list, as before groups existed. */
  groups?: ApiCredentialScopeGroup[];
  presets?: ApiCredentialScopePreset[];
  implications?: ScopeImplications;
  selected: string[];
  onChange: (next: string[]) => void;
  components: AuthComponentInput;
}

interface ResolvedGroup {
  id: string;
  label: string;
  description: string | null;
  sensitive: boolean;
  scopes: ApiCredentialScope[];
}

/** Groups limited to offered scopes (first group wins), with the leftovers collected in a final "Other" group. */
function resolveGroups(scopes: ApiCredentialScope[], groups: ApiCredentialScopeGroup[] | undefined): ResolvedGroup[] | null {
  if (!Array.isArray(groups) || groups.length === 0) {
    return null;
  }
  const byId = new Map(scopes.map((scope) => [scope.id, scope]));
  const placed = new Set<string>();
  const resolved: ResolvedGroup[] = [];
  for (const group of groups) {
    const members: ApiCredentialScope[] = [];
    for (const id of group.scopes ?? []) {
      const scope = byId.get(id);
      if (scope && !placed.has(id)) {
        placed.add(id);
        members.push(scope);
      }
    }
    if (members.length > 0) {
      resolved.push({ id: group.id, label: group.label, description: group.description ?? null, sensitive: group.sensitive === true, scopes: members });
    }
  }
  const rest = scopes.filter((scope) => !placed.has(scope.id));
  if (rest.length > 0) {
    resolved.push({ id: 'other', label: 'Other permissions', description: null, sensitive: false, scopes: rest });
  }

  return resolved.length > 0 ? resolved : null;
}

function DefaultBadge(props: React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} />;
}

const touchRow: React.CSSProperties = {
  display: 'flex',
  gap: '0.625rem',
  alignItems: 'flex-start',
  minHeight: 44,
  padding: '0.5rem 0',
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
};
const mutedStyle: React.CSSProperties = { opacity: 0.7 };
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
  gap: '1rem',
  alignItems: 'start',
};
const boxStyle: React.CSSProperties = { margin: 0, minWidth: 0, border: '1px solid rgba(128, 128, 128, 0.35)', borderRadius: 10, padding: '0.25rem 1rem 0.75rem' };

export function ScopePicker({ idPrefix, scopes, groups, presets, implications, selected, onChange, components }: ScopePickerProps) {
  const { Checkbox, Button, Badge, Alert } = resolveAuthComponents(components);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const catalog = React.useMemo(() => scopes.map((scope) => scope.id), [scopes]);
  const closed = React.useMemo(() => closeImplications(restrictImplications(implications, new Set(catalog))), [implications, catalog]);
  const layout = React.useMemo(() => resolveGroups(scopes, groups), [scopes, groups]);
  const offeredPresets = React.useMemo(
    () => (presets ?? []).filter((preset) => preset.scopes.length > 0 && preset.scopes.every((id) => catalog.includes(id))),
    [presets, catalog],
  );
  const cascades = Object.keys(closed).length > 0;
  const chosen = new Set(selected);

  const commit = (next: Set<string>) => onChange(inCatalogOrder(next, catalog));
  const toggle = (id: string, checked: boolean) => {
    if (layout === null && !cascades) {
      // The flat list as it always was: choices stay in the order they were made.
      onChange(checked ? [...selected, id] : selected.filter((value) => value !== id));

      return;
    }
    commit(checked ? withScopes(selected, [id], closed) : withoutScopes(selected, [id], closed));
  };

  const renderRow = (scope: ApiCredentialScope, grouped: boolean) => {
    const id = `${idPrefix}-${scope.id}`;
    const needers = neededBy(scope.id, selected, closed);
    const noteId = `${id}-needed`;
    const row = (
      <label key={scope.id} htmlFor={id} style={grouped ? { ...touchRow, cursor: 'pointer' } : { overflowWrap: 'anywhere' }}>
        {Checkbox ? (
          <Checkbox id={id} checked={chosen.has(scope.id)} onCheckedChange={(checked) => toggle(scope.id, checked)} />
        ) : (
          <input
            id={id}
            type="checkbox"
            checked={chosen.has(scope.id)}
            aria-describedby={needers.length > 0 ? noteId : undefined}
            onChange={(event) => toggle(scope.id, event.target.checked)}
            style={grouped ? { flex: 'none', width: 16, height: 16, margin: '2px 0 0' } : undefined}
          />
        )}{' '}
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <code>{scope.id}</code> <span style={mutedStyle}>{scope.description}</span>
        </span>
      </label>
    );
    if (needers.length === 0) {
      return row;
    }

    return (
      <div key={scope.id} style={{ minWidth: 0 }}>
        {row}
        <small id={noteId} style={{ ...mutedStyle, display: 'block', paddingLeft: grouped ? 26 : 0, overflowWrap: 'anywhere' }}>
          needed by {needers.join(', ')}
        </small>
      </div>
    );
  };

  if (layout === null) {
    return (
      <fieldset style={{ display: 'grid', gap: '0.25rem', border: 0, padding: 0, minWidth: 0 }}>
        <legend>Permissions</legend>
        {scopes.map((scope) => renderRow(scope, false))}
      </fieldset>
    );
  }

  const pressed = offeredPresets.find((preset) => sameSelection(selected, preset.scopes));
  const plain = layout.filter((group) => !group.sensitive);
  const sensitive = layout.filter((group) => group.sensitive);
  const Chip = Badge ?? DefaultBadge;

  return (
    <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <strong>Permissions</strong>
        {offeredPresets.length > 0 && <span style={mutedStyle}>Start from a preset, then adjust any permission below. The credential stores exactly the permissions you tick.</span>}
      </div>
      {offeredPresets.length > 0 && (
        <div style={{ display: 'grid', gap: '0.625rem' }}>
          <div role="group" aria-label="Presets" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {offeredPresets.map((preset) => {
              const isPressed = pressed?.id === preset.id;

              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant={isPressed ? 'default' : 'outline'}
                  aria-pressed={isPressed}
                  style={{ minHeight: 44, maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'normal', textAlign: 'left' }}
                  onClick={() => commit(withScopes([], preset.scopes, closed))}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
          <p aria-live="polite" style={{ margin: 0, ...mutedStyle, overflowWrap: 'anywhere' }}>
            {pressed ? pressed.description : 'Custom selection. Pick a preset to replace it, or keep adjusting below.'}
          </p>
        </div>
      )}
      {plain.length > 0 && (
        <div style={gridStyle}>
          {plain.map((group) => (
            <fieldset key={group.id} style={{ ...boxStyle, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <legend style={{ padding: '0 0.375rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{group.label}</legend>
              {group.scopes.map((scope) => renderRow(scope, true))}
            </fieldset>
          ))}
        </div>
      )}
      {sensitive.map((group) => {
        const ids = group.scopes.map((scope) => scope.id);
        const count = ids.filter((id) => chosen.has(id)).length;
        const state = count === 0 ? 'none' : count === ids.length ? 'all' : 'some';
        const parentId = `${idPrefix}-group-${group.id}`;
        const listId = `${parentId}-scopes`;
        const isOpen = open[group.id] === true;
        const warning = group.description !== null && group.description !== '' ? group.description : null;

        return (
          <fieldset key={group.id} style={{ ...boxStyle, display: 'grid', gap: '0.375rem', paddingBottom: '0.875rem' }}>
            <legend style={{ padding: '0 0.375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ overflowWrap: 'anywhere' }}>{group.label}</span>
              <Chip style={{ fontSize: 12, fontWeight: 500, border: '1px solid currentColor', borderRadius: 999, padding: '3px 8px', lineHeight: 1 }}>Sensitive</Chip>
            </legend>
            {warning !== null &&
              (() => {
                const content = (
                  <>
                    <TriangleAlert aria-hidden="true" size={16} style={{ flex: 'none', marginTop: 2 }} />
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{warning}</span>
                  </>
                );
                const style: React.CSSProperties = { margin: '0.25rem 0 0', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' };

                return Alert ? (
                  <Alert style={style}>{content}</Alert>
                ) : (
                  <p style={{ ...style, color: '#b45309' }}>{content}</p>
                );
              })()}
            <label htmlFor={parentId} style={{ ...touchRow, cursor: 'pointer' }}>
              <input
                id={parentId}
                type="checkbox"
                checked={state === 'all'}
                aria-checked={state === 'some' ? 'mixed' : state === 'all'}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = state === 'some';
                  }
                }}
                onChange={() => commit(state === 'all' ? withoutScopes(selected, ids, closed) : withScopes(selected, ids, closed))}
                style={{ flex: 'none', width: 16, height: 16, margin: '2px 0 0' }}
              />{' '}
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <strong>{group.label}</strong>{' '}
                <span style={mutedStyle}>
                  {state === 'all'
                    ? `All ${ids.length} ${group.label} permissions are selected.`
                    : state === 'some'
                      ? `${count} of ${ids.length} ${group.label} permissions are selected.`
                      : `Selects all ${ids.length} ${group.label} permissions.`}
                </span>
              </span>
            </label>
            <div>
              <Button
                type="button"
                variant="ghost"
                aria-expanded={isOpen}
                aria-controls={listId}
                style={{ minHeight: 44, whiteSpace: 'normal', textAlign: 'left' }}
                onClick={() => setOpen((current) => ({ ...current, [group.id]: !isOpen }))}
              >
                <ChevronRight aria-hidden="true" size={16} style={{ flex: 'none', transition: 'transform 120ms', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                {isOpen ? 'Hide' : 'Adjust'} individual {group.label} permissions
              </Button>
            </div>
            {isOpen && (
              <div id={listId} style={{ ...gridStyle, columnGap: '1.5rem', gap: '0 1.5rem', paddingLeft: '1.5rem', marginLeft: 7, borderLeft: '2px solid rgba(128, 128, 128, 0.35)' }}>
                {group.scopes.map((scope) => renderRow(scope, true))}
              </div>
            )}
          </fieldset>
        );
      })}
      <div style={{ borderTop: '1px solid rgba(128, 128, 128, 0.35)', paddingTop: '0.875rem', display: 'grid', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontWeight: 500 }} role="status">
          {selected.length === 0
            ? 'No permissions selected.'
            : `This credential will request ${selected.length} ${selected.length === 1 ? 'permission' : 'permissions'}:`}
        </p>
        {selected.length > 0 && (
          <p style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {selected.map((id) => (
              <code key={id} style={{ overflowWrap: 'anywhere' }}>
                {id}
              </code>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
