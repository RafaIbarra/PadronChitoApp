import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
  Keyboard, ScrollView,
} from "react-native";
import * as SQLite from "expo-sqlite";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Linking } from "react-native";

let _db = null;

async function getDatabase() {
  if (_db) return _db;

  const dbName = "app.db";
  const sqliteDir = FileSystem.documentDirectory + "SQLite/";
  const dbPath = sqliteDir + dbName;

  const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  }

  const fileInfo = await FileSystem.getInfoAsync(dbPath);
  if (!fileInfo.exists) {
    const asset = Asset.fromModule(require("./assets/database/app.db"));
    await asset.downloadAsync();
    await FileSystem.copyAsync({ from: asset.localUri, to: dbPath });
  }

  _db = SQLite.openDatabaseSync(dbName);
  return _db;
}

function FilaResultado({ label, valor, horizontal = false }) {
  return (
    <View style={[s.filaRes, horizontal && s.filaResRow]}>
      <Text style={[s.filaLabel, horizontal && s.filaLabelRow]}>{label}</Text>
      <Text style={[s.filaValor, horizontal && s.filaValorRow]}>{valor}</Text>
    </View>
  );
}

function MesaOrden({ mesa, orden }) {
  return (
    <View style={s.mesaOrdenRow}>
      <View style={s.mesaOrdenHalf}>
        <Text style={s.filaLabel}>Mesa</Text>
        <Text style={s.filaValor}>{mesa}</Text>
      </View>
      <View style={s.mesaOrdenDivider} />
      <View style={s.mesaOrdenHalf}>
        <Text style={s.filaLabel}>Orden</Text>
        <Text style={s.filaValor}>{orden}</Text>
      </View>
    </View>
  );
}

function SinResultados() {
  return (
    <View style={s.sinDatos}>
      <Text style={s.sinDatosIcon}>🔍</Text>
      <Text style={s.sinDatosTitulo}>NO ES ELECTOR DE LUQUE</Text>
      <Text style={s.sinDatosSubtitulo}>Verificá el número de cédula ingresado</Text>
    </View>
  );
}
function FilaUbicacion({ url }) {
  async function abrirMapa() {
    if (!url) return;
    const soportado = await Linking.canOpenURL(url);
    if (soportado) {
      await Linking.openURL(url);
    }
  }

  return (
    <View style={s.filaRes}>
      <Text style={s.filaLabel}>Ubicación del local</Text>
      <TouchableOpacity style={s.btnMapa} onPress={abrirMapa}>
        <Text style={s.btnMapaTxt}>📍 Abrir en Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [cedula, setCedula] = useState("");
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function consultar() {
    if (!cedula.trim()) return;
    Keyboard.dismiss();
    setCargando(true);
    setResultado(null);
    try {
      const db = await getDatabase();
      const rows = db.getAllSync(
        "SELECT * FROM datos WHERE CI = ? LIMIT 1",
        [cedula.trim()]
      );
      setResultado(rows.length > 0 ? rows[0] : {});
    } catch (e) {
      setResultado({});
    } finally {
      setCargando(false);
    }
  }

  const hayDatos = resultado && Object.keys(resultado).length > 0;
  const sinDatos = resultado && Object.keys(resultado).length === 0;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.container} edges={["top", "bottom"]}>

        {/* Header */}
        <View style={s.header}>
          <Image
            source={require("./assets/logo.jpeg")}
            style={s.headerImg}
            resizeMode="cover"
          />
        </View>

        {/* Body */}
        <View style={s.body}>
          <Text style={s.titulo}>CONSULTA PADRÓN</Text>
          <Text style={s.subtitulo}>Padrón Internas Municipales del 7 de junio del 2026</Text>

          {/* Input */}
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="Ingresá tu número de cédula"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={cedula}
              onChangeText={setCedula}
              onSubmitEditing={consultar}
              returnKeyType="search"
            />
          </View>

          {/* Botón */}
          <View style={s.botones}>
            <TouchableOpacity
              style={[s.btn, !cedula.trim() && s.btnDisabled]}
              onPress={consultar}
              disabled={cargando || !cedula.trim()}
            >
              <Text style={s.btnTxt}>Consultar</Text>
            </TouchableOpacity>
          </View>

          {cargando && (
            <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 32 }} />
          )}

          {/* Resultados */}
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {sinDatos && <SinResultados />}

            {hayDatos && (
              <View style={s.card}>
                <FilaResultado label="Nombre y Apellido"   valor={resultado.NOMBRE_APELLIDO} />
                <FilaResultado label="Seccional"           valor={resultado.SECCIONAL} />
                <FilaResultado label="Local de votación"   valor={resultado.LOCAL_VOTACION} />
                <MesaOrden mesa={resultado.MESA} orden={resultado.ORDEN} />
                {/* <FilaResultado label="Ubicación del local" valor={resultado.UBICACION} /> */}
                <FilaUbicacion url={resultado.UBICACION} />
              </View>


            )}
          </ScrollView>

        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#f1f5f9" },

  // Header
  header:          { height: "30%", width: "100%", backgroundColor: "#fff",
                     alignItems: "center", justifyContent: "center",
                     borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerImg:       { width: "100%", height: "100%" },

  // Body
  body:            { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  titulo:          { fontSize: 24, fontWeight: "600", color: "#1e293b",
                     marginBottom: 5, textAlign: "center",color:'red' },

  subtitulo:          { fontSize: 18, fontWeight: "600", color: "#1e293b",
                     marginBottom: 5, textAlign: "center"},

  // Input
  inputRow:        { marginBottom: 5 },
  input:           { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1",
                     borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
                     fontSize: 16, color: "#1e293b" },

  // Botones
  botones:         { alignItems: "center", marginBottom: 5 },
  btn:             { width: "75%", backgroundColor: "#4f46e5", paddingVertical: 10,
                     borderRadius: 10, alignItems: "center" },
  btnGris:         { backgroundColor: "#64748b" },
  btnDisabled:     { backgroundColor: "#a5b4fc" },
  btnTxt:          { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Scroll
  scroll:          { flex: 1 },
  scrollContent:   { paddingBottom: 24, flexGrow: 1 },

  // Card
  card:            { backgroundColor: "#fff", borderRadius: 14,
                     padding: 18, gap: 12,
                     shadowColor: "#000", shadowOpacity: 0.06,
                     shadowRadius: 8, elevation: 3 },

  // FilaResultado
  filaRes:         { borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 2 },
  filaResRow:      { flexDirection: "row", alignItems: "center",
                     justifyContent: "space-between" },
  filaLabel:       { fontSize: 11, fontWeight: "600", color: "#6366f1",
                     textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  filaLabelRow:    { marginBottom: 0, flex: 1 },
  filaValor:       { fontSize: 15, color: "#1e293b", fontWeight: "500" },
  filaValorRow:    { fontSize: 17, color: "#4f46e5", fontWeight: "700",
                     textAlign: "right" },

  // Mesa + Orden juntos
  mesaOrdenRow:    { flexDirection: "row", borderBottomWidth: 1,
                     borderBottomColor: "#f1f5f9", paddingBottom: 10 },
  mesaOrdenHalf:   { flex: 1 },
  mesaOrdenDivider:{ width: 1, backgroundColor: "#e2e8f0", marginHorizontal: 12 },

  // Sin datos
  sinDatos:        { alignItems: "center", marginTop: 40, gap: 8 },
  sinDatosIcon:    { fontSize: 48 },
  sinDatosTitulo:  { fontSize: 17, fontWeight: "600", color: "#334155" },
  sinDatosSubtitulo:{ fontSize: 13, color: "#94a3b8", textAlign: "center" },
});