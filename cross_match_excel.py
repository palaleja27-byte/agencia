import pandas as pd
import json

excel_personal = "Personal R&R .xlsx"
excel_novedades = "NOVEDADES PRIME MARZO 2026.xlsx"
sql_output_file = "insert_operadores_final.sql"

print(f"1. Analizando {excel_novedades} para extraer mapa de IDs...")
id_map = {}

try:
    xl_nov = pd.ExcelFile(excel_novedades)
    for sheet in xl_nov.sheet_names:
        df_nov = pd.read_excel(excel_novedades, sheet_name=sheet)
        if 'NOMBRE Y APELLIDO' in df_nov.columns and 'ID DE PERFIL ' in df_nov.columns:
            for idx, row in df_nov.iterrows():
                name = str(row['NOMBRE Y APELLIDO']).strip().upper()
                id_perfil = str(row['ID DE PERFIL ']).strip()
                if name and id_perfil and name != 'NAN' and id_perfil != 'NAN':
                    # Limpiar ID (a veces viene con .0)
                    if id_perfil.endswith('.0'): id_perfil = id_perfil[:-2]
                    id_perfil = ''.join(filter(str.isdigit, id_perfil))
                    
                    if not id_perfil: continue
                        
                    if name not in id_map:
                        id_map[name] = set()
                    id_map[name].add(id_perfil)
except Exception as e:
    print(f"Error procesando IDs: {e}")

print(f"Se encontraron {len(id_map)} operadores con ID asignado en Novedades.")

print(f"\n2. Analizando {excel_personal} para armar la base final...")
agency_mapping = {
    'antiguos': 'Amolatina',
    'prime': 'Talkytimes',
    'level 360': 'Talkytimes',
    'level360': 'Talkytimes',
    'camilo': 'Talkytimes Camilo'
}

sql_statements = [
    "-- ===========================================================",
    "-- INSERCIÓN FINAL DE OPERADORES (CONCRUCE DE IDs DE NOVEDADES)",
    "-- ===========================================================\n"
]

total_generados = 0
sin_id = 0

def find_id(name, id_map):
    # Intentar búsqueda exacta
    n = name.strip().upper()
    if n in id_map: return list(id_map[n])
    
    # Búsqueda parcial si solo coinciden parte de los nombres
    # Esto es básico, para nombres más complejos habría que usar fuzzy matching.
    matches = []
    parts = n.split()
    if len(parts) >= 2:
        for map_name in id_map.keys():
            if parts[0] in map_name and parts[1] in map_name:
                matches.extend(list(id_map[map_name]))
    return list(set(matches))

try:
    xl_pers = pd.ExcelFile(excel_personal)
    for sheet in xl_pers.sheet_names:
        sheet_lower = sheet.lower().strip()
        agencia = agency_mapping.get(sheet_lower, 'General')
        for k in agency_mapping.keys():
            if k in sheet_lower: 
                agencia = agency_mapping[k]
                break

        df_pers = pd.read_excel(excel_personal, sheet_name=sheet)
        nombres_cands = [c for c in df_pers.columns if isinstance(c, str) and 'NOMBRE' in c.upper()]
        
        if not nombres_cands:
            continue
            
        nombres_col = nombres_cands[0]
        count = 0 
        for _, row in df_pers.dropna(subset=[nombres_col]).iterrows():
            nombre = str(row[nombres_col]).strip().upper()
            if nombre == 'NAN': continue
            
            ids = find_id(nombre, id_map)
            
            if ids:
                for uid in ids:
                    nombre_sql = nombre.replace("'", "''")
                    sql = f"INSERT INTO public.operadores (id_perfil, nombre_real, agencia, estado) VALUES ({uid}, '{nombre_sql}', '{agencia}', 'Activo') ON CONFLICT (id_perfil) DO UPDATE SET nombre_real = EXCLUDED.nombre_real, agencia = EXCLUDED.agencia;"
                    sql_statements.append(sql)
                    count += 1
                    total_generados += 1
            else:
                sin_id += 1
                
        print(f" - Hoja '{sheet}': {count} IDs mapeados con éxito en la agencia {agencia}.")
except Exception as e:
    print(f"Error procesando hoja de personal: {e}")

with open(sql_output_file, 'w', encoding='utf-8') as f:
    f.write("\n".join(sql_statements))

print(f"\n¡Éxito! Archivo SQL generado con {total_generados} registros ({sin_id} sin ID encontrado).")
