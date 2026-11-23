import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

// One icon system: SF Symbols on iOS, Material Symbols on Android. Decorative; the text beside it carries the meaning.
export function Icon({ ios, android, size = 20, color }: { ios: SFSymbol; android: AndroidSymbol; size?: number; color: string }) {
  return <SymbolView name={{ ios, android }} size={size} tintColor={color} accessible={false} />;
}
