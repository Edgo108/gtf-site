"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { findNameSuggestion } from "@/lib/suggestions/names";
import { fieldClass } from "@/lib/ui/styles";

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

// Champ de saisie avec suggestion de nom en texte fantôme façon Gmail :
// dès que le texte tapé est le début (sans tenir compte de la casse ni
// des accents) d'un nom de `suggestions`, la suite du nom s'affiche en
// gris après le curseur. Tab ou flèche droite l'accepte, continuer à
// taper l'ignore.
//
// - `multiple` : champ de plusieurs noms séparés par virgule,
//   point-virgule ou retour à la ligne (textarea) ; seul le dernier nom
//   est complété. Sinon : un seul nom (input).
// - `suggestions` : noms triés par pertinence (voir `rankNames`) ; le
//   premier qui correspond est proposé.
// - La suggestion n'apparaît que si le champ a le focus et que le curseur
//   est à la fin du texte, et ne bloque jamais la saisie ni le
//   comportement normal de Tab quand rien n'est proposé.
export function NameSuggestField({
  id,
  name,
  suggestions,
  multiple = false,
  rows = 2,
  required,
  defaultValue = "",
  onValueChange,
  onBlur,
}: {
  id?: string;
  name?: string;
  suggestions: string[];
  multiple?: boolean;
  rows?: number;
  required?: boolean;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onBlur?: (event: FocusEvent<FieldElement>) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const [caretAtEnd, setCaretAtEnd] = useState(false);
  const fieldRef = useRef<FieldElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const suggestion =
    focused && caretAtEnd ? findNameSuggestion(value, suggestions, multiple) : null;

  // La couche fantôme est superposée au champ : elle doit suivre son
  // défilement (texte long dans un input) et le textarea s'agrandit avec
  // son contenu plutôt que de défiler, pour que les deux restent alignés.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    if (field instanceof HTMLTextAreaElement) {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
    }
    if (mirrorRef.current) {
      mirrorRef.current.scrollLeft = field.scrollLeft;
      mirrorRef.current.scrollTop = field.scrollTop;
    }
  });

  function setField(element: FieldElement | null) {
    fieldRef.current = element;
  }

  function syncCaret(field: FieldElement) {
    const end = field.value.length;
    setCaretAtEnd(field.selectionStart === end && field.selectionEnd === end);
  }

  function update(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  function handleChange(event: ChangeEvent<FieldElement>) {
    update(event.target.value);
    syncCaret(event.target);
  }

  function handleKeyDown(event: KeyboardEvent<FieldElement>) {
    if (
      !suggestion ||
      event.nativeEvent.isComposing ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (event.key === "Tab" || event.key === "ArrowRight") {
      event.preventDefault();
      update(value.slice(0, suggestion.start) + suggestion.name);
    }
  }

  const sharedProps = {
    id,
    name,
    required,
    value,
    autoComplete: "off",
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onSelect: (event: SyntheticEvent<FieldElement>) =>
      syncCaret(event.currentTarget),
    onFocus: (event: FocusEvent<FieldElement>) => {
      setFocused(true);
      syncCaret(event.currentTarget);
    },
    onBlur: (event: FocusEvent<FieldElement>) => {
      setFocused(false);
      onBlur?.(event);
    },
    onScroll: (event: SyntheticEvent<FieldElement>) => {
      if (mirrorRef.current) {
        mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
        mirrorRef.current.scrollTop = event.currentTarget.scrollTop;
      }
    },
  };

  return (
    <div className="relative">
      {multiple ? (
        <textarea
          {...sharedProps}
          ref={setField}
          rows={rows}
          className={`${fieldClass} resize-none overflow-hidden`}
        />
      ) : (
        <input
          {...sharedProps}
          ref={setField}
          type="text"
          className={fieldClass}
        />
      )}
      {suggestion && (
        // Même police/padding/bordure que le champ (bordure transparente) :
        // le texte déjà tapé est invisible et sert seulement à décaler la
        // suite fantôme au bon endroit.
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 w-full overflow-hidden border border-transparent px-3 py-2 text-sm ${
            multiple ? "whitespace-pre-wrap break-words" : "whitespace-pre"
          }`}
        >
          <span className="invisible">{value}</span>
          <span className="text-gtf-text-muted/60">{suggestion.suffix}</span>
        </div>
      )}
    </div>
  );
}
