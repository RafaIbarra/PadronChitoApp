import { useState, useCallback } from "react";
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

async function getDatabase() {
  const dbName = "app.db";
  const sqliteDir = FileSystem.documentDirectory + "SQLite/";
  const dbPath = sqliteDir + dbName;

  // console.log("📁 Directorio SQLite:", sqliteDir);
  // console.log("📄 Ruta base de datos:", dbPath);

  const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
  // console.log("📂 ¿Existe directorio?", dirInfo.exists);

  if (!dirInfo.exists) {
    // console.log("📂 Creando directorio...");
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  }

  const fileInfo = await FileSystem.getInfoAsync(dbPath);
  // console.log("📄 ¿Existe DB?", fileInfo.exists);
  // console.log("📄 Tamaño DB:", fileInfo.size || "N/A");

  // 🔴 FORZAR recopia: borra siempre y copia de nuevo
  // console.log("🔄 Forzando recopia de base de datos...");
  await FileSystem.deleteAsync(dbPath, { idempotent: true }).catch(() => {});
  
  // console.log("📥 Descargando asset...");
  const asset = Asset.fromModule(require("./assets/database/app.db"));
  await asset.downloadAsync();
  // console.log("📥 Asset descargado, localUri:", asset.localUri);

  // console.log("📋 Copiando a:", dbPath);
  await FileSystem.copyAsync({ from: asset.localUri, to: dbPath });

  // Verificar después de copiar
  const fileInfoAfter = await FileSystem.getInfoAsync(dbPath);
  // console.log("✅ DB copiada, tamaño:", fileInfoAfter.size);

  return SQLite.openDatabaseSync(dbName);
}

// 🔍 Función para verificar qué hay en la base de datos
async function debugDatabase() {
  try {
    const db = await getDatabase();
    
    // Verificar tablas
    const tables = db.getAllSync("SELECT name FROM sqlite_master WHERE type='table'");
    // console.log("📊 Tablas en DB:", tables);

    // Verificar columnas de tabla datos
    const columns = db.getAllSync("PRAGMA table_info(datos)");
    // console.log("📋 Columnas:", columns);

    // Contar filas
    const count = db.getAllSync("SELECT COUNT(*) as total FROM datos");
    // console.log("🔢 Total filas:", count[0]?.total);

    // Ver primera fila
    const first = db.getAllSync("SELECT * FROM datos LIMIT 1");
    // console.log("👤 Primera fila:", first);

    // Verificar si la columna CI existe
    const ciCheck = db.getAllSync("SELECT CI FROM datos LIMIT 1");
    // console.log("✅ CI funciona:", ciCheck);

    return db;
  } catch (e) {
    console.error("❌ Error debug:", e);
    throw e;
  }
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
  const [debugInfo, setDebugInfo] = useState("");

  // 🔍 Debug al iniciar
  useState(() => {
    debugDatabase().catch(e => {
      console.error("Error inicial:", e);
      setDebugInfo("Error: " + e.message);
    });
  });

  const consultar = useCallback(async (valor) => {
    // console.log("🔍 Consultando CI:", valor);
    
    if (!valor || !valor.trim()) {
      setResultado(null);
      return;
    }
    
    setCargando(true);
    setResultado(null);
    
    try {
      const db = await getDatabase();
      
      // 🔍 Debug: ver qué hay en la base
      const allRows = db.getAllSync("SELECT * FROM datos LIMIT 5");
      // console.log("📊 Muestra de datos:", allRows);

      // Consulta exacta
      const query = 'SELECT * FROM datos WHERE "CI" = ? LIMIT 1';
      // console.log("📝 Query:", query);
      // console.log("📝 Parámetro:", valor.trim());

      const rows = db.getAllSync(query, [valor.trim()]);
      // console.log("📊 Resultados encontrados:", rows.length);
      // console.log("📊 Datos:", rows);

      if (rows.length > 0) {
        setResultado(rows[0]);
      } else {
        // 🔍 Si no encuentra, buscar similar
        const similar = db.getAllSync('SELECT * FROM datos WHERE "CI" LIKE ? LIMIT 3', [`%${valor.trim()}%`]);
        // console.log("📊 Resultados similares:", similar);
        setResultado({});
      }
    } catch (e) {
      console.error("❌ Error en consulta:", e);
      setDebugInfo("Error: " + e.message);
      setResultado({});
    } finally {
      setCargando(false);
    }
  }, []);

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
          <Text style={s.subtitulo}>Elecciones Municipales del 4 de octubre del 2026</Text>

          {/* Debug info */}
          {debugInfo ? (
            <View style={s.debugBox}>
              <Text style={s.debugText}>{debugInfo}</Text>
            </View>
          ) : null}

          {/* Input */}
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

          {/* Botón Consultar */}
          <View style={s.botones}>
            <TouchableOpacity
              style={[s.btn, !cedula.trim() && s.btnDisabled]}
              onPress={handleBuscar}
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

  // Debug
  debugBox: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 10, marginBottom: 10 },
  debugText: { color: "#991b1b", fontSize: 12 },
});