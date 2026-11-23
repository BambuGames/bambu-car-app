import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radiusChip } from './theme';

// A Zulassungsbescheinigung field code (B, D.3, P.2 …) in its small outlined box.
export function CodeChip({ code }: { code: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.code}>{code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radiusChip,
    backgroundColor: colors.paper,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 1,
  },
  code: { fontFamily: fonts.code, fontSize: 11, color: colors.ink2 },
});
