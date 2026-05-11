import codecs

file_path = 'index.html'

with codecs.open(file_path, 'r', 'utf-8') as f:
    content = f.read()

# Replace Intento 1 query
content = content.replace(
    ".gte('fecha_corte', FECHA_INICIO)\n            .order('fecha_corte', { ascending: false });",
    ".gte('fecha_dia', '2026-02-01')\n            .order('id', { ascending: false });"
)

# Replace Fallback query
content = content.replace(
    ".select('id_perfil, puntos, fecha_corte, agencia')\n              .gte('fecha_corte', FECHA_INICIO)\n              .order('fecha_corte', { ascending: false });",
    ".select('id_perfil, puntos, fecha_corte, fecha_dia, agencia')\n              .gte('fecha_dia', '2026-02-01')\n              .order('id', { ascending: false });"
)

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(content)

print('File index.html updated successfully.')
