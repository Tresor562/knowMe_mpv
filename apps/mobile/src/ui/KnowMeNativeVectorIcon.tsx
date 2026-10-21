import { createElement, type FunctionComponent } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { useAppearance } from '../AppearanceProvider';

/**
 * The native counterpart of the canonical 24 x 24 Web glyph family.
 * Geometry comes from scripts/export-knowme-vector-contract.mjs, with five
 * native-only glyphs defined in scripts/check-knowme-native-vector-contract.mjs.
 * Never load or evaluate raw external SVG/HTML in this renderer.
 */
type VectorNode = {
  tag: keyof typeof COMPONENTS;
  attrs: Record<string, string | number>;
  children?: VectorNode[];
};
type VectorGlyph = {
  role: string;
  inactive: VectorNode[];
  active: VectorNode[];
};
const COMPONENTS = { path: Path, circle: Circle, ellipse: Ellipse,
  rect: Rect, line: Line, polyline: Polyline, polygon: Polygon, g: G };

const contract = require('./knowme-native-vector-contract.json') as {
  viewBox: number[];
  glyphs: Record<string, VectorGlyph>;
};

const LEGACY_NAMES: Record<string, string> = {
  messages: 'chats',
  bell: 'notifications',
  spark: 'sparkles',
  'video-call': 'video',
  'phone-call': 'phone',
  'more-vertical': 'more',
  paperclip: 'attach'
};

export function hasKnowMeNativeVectorGlyph(name: string) {
  const resolved = LEGACY_NAMES[name] ?? name;
  return Object.prototype.hasOwnProperty.call(contract.glyphs, resolved);
}

export function KnowMeNativeVectorIcon({
  name, size = 22, color = '#AEB6C4', strokeWidth = 1.9, selected = false
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  selected?: boolean;
}) {
  const { colors } = useAppearance();
  const resolved = LEGACY_NAMES[name] ?? name;
  const glyph = contract.glyphs[resolved];
  if (!glyph) return null;

  const paint = (value: string | number): string | number =>
    value === 'currentColor' ? color :
    value === 'var(--bg)' ? colors.background : value;

  const render = (node: VectorNode, index: number): ReturnType<typeof createElement> => {
    const Element = COMPONENTS[node.tag];
    const attrs = Object.fromEntries(
      Object.entries(node.attrs).map(([key, value]) => [key, paint(value)])
    );
    return createElement(Element as any, { key: index, ...attrs },
      ...((node.children ?? []).map(render)));
  };

  // The native Svg class is runtime-compatible with React Native, but
  // Expo Web and native may resolve different @types/react revisions. Avoid
  // JSX-class type checking on that cross-package class, not vector rendering.
  return createElement(
    Svg as unknown as FunctionComponent<Record<string, unknown>>,
    {
      width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: color, strokeWidth,
      strokeLinecap: 'round', strokeLinejoin: 'round',
      accessible: false, focusable: false
    },
    ...(selected ? glyph.active : glyph.inactive).map(render)
  );
}
