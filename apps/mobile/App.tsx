import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.card}>
        <Text style={styles.logo}>KnowMe</Text>
        <Text style={styles.subtitle}>Mieux se connaître, vraiment.</Text>
        <TouchableOpacity style={styles.button}><Text style={styles.buttonText}>Commencer</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#071410',justifyContent:'center',padding:24},
  card:{backgroundColor:'#10231d',borderRadius:28,padding:28},
  logo:{color:'#f4fff9',fontSize:48,fontWeight:'800'},
  subtitle:{color:'#a7b9b1',fontSize:18,marginVertical:16},
  button:{backgroundColor:'#45e6bd',padding:16,borderRadius:16},
  buttonText:{color:'#052017',fontWeight:'800',textAlign:'center'}
});
