import { useState, useEffect, useCallback } from "react";
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

let searchTimeout = null;
let dbInstance = null; // 🔴 Conexión global única

async function initDatabase() {
  if (dbInstance) return dbInstance; // Ya inicializada

  const dbName = "app.db";
  const sqliteDir = FileSystem.documentDirectory + "SQLite/";
  const dbPath = sqliteDir + dbName;

  // Crear directorio
  const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  }

  // Borrar y recopiar siempre (para datos actualizados)
  try {
    await FileSystem.deleteAsync(dbPath, { idempotent: true });
  } catch (e) {}

  const asset = Asset.fromModule(require("./assets/database/app.db"));
  await asset.downloadAsync();
  
  await FileSystem.copyAsync({
    from: asset.localUri,
    to: dbPath
  });

  // Abrir UNA SOLA VEZ
  dbInstance = SQLite.openDatabaseSync(dbName);
  
  // Verificar que funciona
  const test = dbInstance.getAllSync("SELECT COUNT(*) as total FROM datos");
  console.log("✅ DB inicializada, filas:", test[0].total);

  return dbInstance;
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
  const [dbReady, setDbReady] = useState(false);

  // 🔴 Inicializar base de datos UNA VEZ al montar
  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch(e => {
        console.error("❌ Error init DB:", e);
      });
  }, []);

  const consultar = useCallback(async (valor) => {
    if (!dbReady || !valor || !valor.trim()) {
      setResultado(null);
      return;
    }
    
    setCargando(true);
    setResultado(null);
    
    try {
      // Usar la conexión global, NO crear nueva
      const rows = dbInstance.getAllSync(
        'SELECT * FROM datos WHERE "CI" = ? LIMIT 1',
        [valor.trim()]
      );
      
      console.log("🔍 Resultados:", rows.length);
      setResultado(rows.length > 0 ? rows[0] : {});
    } catch (e) {
      console.error("❌ Error consulta:", e);
      setResultado({});
    } finally {
      setCargando(false);
    }
  }, [dbReady]);

  function handleChangeText(texto) {
    setCedula(texto);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (texto.trim().length === 0) {
      setResultado(null);
      return;
    }
    
    searchTimeout = setTimeout(() => {
      consultar(texto);
    }, 500);
  }

  function handleBuscar() {
    Keyboard.dismiss();
    consultar(cedula);
  }

  const hayDatos = resultado && Object.keys(resultado).length > 0;
  const sinDatos = resultado && Object.keys(resultado).length === 0;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.container} edges={["top", "bottom"]}>

        <View style={s.header}>
          <Image
            source={require("./assets/logo.jpeg")}
            style={s.headerImg}
            resizeMode="cover"
          />
        </View>

        <View style={s.body}>
          <Text style={s.titulo}>CONSULTA PADRÓN</Text>
          <Text style={s.subtitulo}>Elecciones Municipales del 4 de octubre del 2026</Text>

          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="Ingresá tu número de cédula"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={cedula}
              onChangeText={handleChangeText}
              returnKeyType="search"
            />
          </View>

          <View style={s.botones}>
            <TouchableOpacity
              style={[s.btn, (!cedula.trim() || !dbReady) && s.btnDisabled]}
              onPress={handleBuscar}
              disabled={cargando || !cedula.trim() || !dbReady}
            >
              <Text style={s.btnTxt}>
                {dbReady ? "Consultar" : "Cargando..."}
              </Text>
            </TouchableOpacity>
          </View>

          {cargando && (
            <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 32 }} />
          )}

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {sinDatos && <SinResultados />}

            {hayDatos && (
              <View style={s.card}>
                <FilaResultado label="Nombre y Apellido" valor={resultado.NOMBRE_APELLIDO} />
                <FilaResultado label="Seccional" valor={resultado.SECCIONAL} />
                <FilaResultado label="Local de votación" valor={resultado.LOCAL_VOTACION} />
                <MesaOrden mesa={resultado.MESA} orden={resultado.ORDEN} />
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
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: { height: "30%", width: "100%", backgroundColor: "#fff",
            alignItems: "center", justifyContent: "center",
            borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerImg: { width: "100%", height: "100%" },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  titulo: { fontSize: 24, fontWeight: "600", color: "#1e293b",
            marginBottom: 5, textAlign: "center", color: 'red' },
  subtitulo: { fontSize: 18, fontWeight: "600", color: "#1e293b",
               marginBottom: 5, textAlign: "center" },

  inputRow: { marginBottom: 5 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1",
           borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
           fontSize: 16, color: "#1e293b" },

  botones: { flexDirection: "row", marginBottom: 5 },
  btn: { flex: 1, backgroundColor: "#4f46e5", paddingVertical: 10,
         borderRadius: 10, alignItems: "center" },
  btnDisabled: { backgroundColor: "#a5b4fc" },
  btnTxt: { color: "#fff", fontWeight: "600", fontSize: 15 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24, flexGrow: 1 },

  card: { backgroundColor: "#fff", borderRadius: 14,
          padding: 18, gap: 12,
          shadowColor: "#000", shadowOpacity: 0.06,
          shadowRadius: 8, elevation: 3 },

  filaRes: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 2 },
  filaResRow: { flexDirection: "row", alignItems: "center",
                justifyContent: "space-between" },
  filaLabel: { fontSize: 11, fontWeight: "600", color: "#6366f1",
               textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  filaLabelRow: { marginBottom: 0, flex: 1 },
  filaValor: { fontSize: 15, color: "#1e293b", fontWeight: "500" },
  filaValorRow: { fontSize: 17, color: "#4f46e5", fontWeight: "700",
                  textAlign: "right" },

  mesaOrdenRow: { flexDirection: "row", borderBottomWidth: 1,
                  borderBottomColor: "#f1f5f9", paddingBottom: 10 },
  mesaOrdenHalf: { flex: 1 },
  mesaOrdenDivider: { width: 1, backgroundColor: "#e2e8f0", marginHorizontal: 12 },

  sinDatos: { alignItems: "center", marginTop: 40, gap: 8 },
  sinDatosIcon: { fontSize: 48 },
  sinDatosTitulo: { fontSize: 17, fontWeight: "600", color: "#334155" },
  sinDatosSubtitulo: { fontSize: 13, color: "#94a3b8", textAlign: "center" },

  btnMapa: { backgroundColor: "#4f46e5", paddingVertical: 10,
             borderRadius: 10, alignItems: "center", marginTop: 5 },
  btnMapaTxt: { color: "#fff", fontWeight: "600", fontSize: 15 },
});