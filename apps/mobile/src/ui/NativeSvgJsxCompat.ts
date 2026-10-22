import type { ComponentType } from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

/**
 * Typed JSX bridge for Expo 53 / React 19.
 *
 * The package's SVG primitives are native class components compiled against a
 * different React Component.shouldComponentUpdate declaration than the JSX
 * types in the mobile build. TypeScript rejects these *construct signatures*
 * (TS2786), even though the native components themselves are valid.
 *
 * Preserve the exact native renderer and each primitive's constructor-prop
 * types; only adapt the JSX-facing constructor type. No fake SVG rendering,
 * component replacement or runtime code is introduced.
 *
 * Delete this bridge once upstream React/svg typings are unified.
 */
export const NativeSvg = Svg as unknown as ComponentType<ConstructorParameters<typeof Svg>[0]>;
export const NativeCircle = Circle as unknown as ComponentType<ConstructorParameters<typeof Circle>[0]>;
export const NativeEllipse = Ellipse as unknown as ComponentType<ConstructorParameters<typeof Ellipse>[0]>;
export const NativePath = Path as unknown as ComponentType<ConstructorParameters<typeof Path>[0]>;
