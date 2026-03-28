import pandas as pd
import sys

# Mapeo de agencias según el nombre de la hoja (en minúsculas para fácil comparación)
agency_mapping = {
    'antiguos': 'Amolatina',
    'prime': 'Talkytimes',
    'level 360': 'Talkytimes',
    'level360': 'Talkytimes',
    'camilo': 'Talkytimes Camilo'
}

excel_file = "NOVEDADES PRIME MARZO 2026.xlsx"
sql_output_file = "insert_operadores.sql"

print(f"Leyendo el archivo Excel: {excel_file}...")
try:
    xl = pd.ExcelFile(excel_file)
except Exception as e:
    print(f"Error al leer el archivo Excel: {e}")
    sys.exit(1)

sheet_names = xl.sheet_names
print(f"Hojas encontradas: {sheet_names}")

sql_statements = [
    "-- ===========================================================",
    "-- INSERCIÓN INICIAL DE OPERADORES DESDE EXCEL",
    "-- (Usando el 'DOCUMENTO' como 'id_perfil' temporalmente)",
    "-- Posteriormente actualizaremos el id_perfil real.",
    "-- ===========================================================\n"
]

total_inserted = 0

for sheet in sheet_names:
    sheet_lower = sheet.lower().strip()
    
    # Determinar qué agencia corresponde a esta hoja
    agencia = "General"
    for key, val in agency_mapping.items():
        if key in sheet_lower:
            agencia = val
            break
            
    try:
        df = pd.read_excel(excel_file, sheet_name=sheet)
    except Exception as e:
        print(f"Error al leer la hoja {sheet}: {e}")
        continue
        
    # Buscar columnas clave (puede que nombres cambien ligeramente)
    nombres_col_candidates = [col for col in df.columns if isinstance(col, str) and 'NOMBRES' in col.upper()]
    doc_cols_candidates = [col for col in df.columns if isinstance(col, str) and 'DOCUMENTO' in col.upper()]
    
    if not nombres_col_candidates or not doc_cols_candidates:
        print(f" - Hoja '{sheet}': No se encontraron columnas requeridas ('DOCUMENTO' y 'NOMBRES...'). Omitiendo.")
        continue
        
    nombres_col = nombres_col_candidates[0]
    doc_col = doc_cols_candidates[0]
    
    # Filtrar solo donde haya documento y nombre válido
    df_valid = df.dropna(subset=[doc_col, nombres_col])
    
    count = 0
    for _, row in df_valid.iterrows():
        try:
            doc = str(row[doc_col]).strip()
            # Limpiar documento si tiene .0 (si pandas lo leyó como float)
            if doc.endswith('.0'): doc = doc[:-2]
            # Extraer solo numeros
            doc = ''.join(filter(str.isdigit, doc))
            if not doc: continue
             
            nombre = str(row[nombres_col]).strip().replace("'", "''") # Escapar comillas para SQL
            if not nombre or nombre.lower() == 'nan': continue
            
            sql = f"INSERT INTO public.operadores (id_perfil, nombre_real, agencia, estado) VALUES ({doc}, '{nombre}', '{agencia}', 'Activo') ON CONFLICT (id_perfil) DO NOTHING;"
            sql_statements.append(sql)
            count += 1
            total_inserted += 1
            
        except Exception as e:
            continue
            
    print(f" - Hoja '{sheet}': {count} registros asignados a '{agencia}'.")

# Guardar en archivo
with open(sql_output_file, 'w', encoding='utf-8') as f:
    f.write("\n".join(sql_statements))

print(f"\n¡Éxito! Archivo SQL '{sql_output_file}' generado con {total_inserted} registros.")
