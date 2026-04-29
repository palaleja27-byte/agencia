file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines before: {len(lines)}")

# Find and delete the orphaned block (tarjeta.className through contenedor.appendChild)
start_orphan = None
end_orphan = None

for i, line in enumerate(lines):
    if start_orphan is None and "tarjeta.className = 'op-card'" in line and i > 13050 and i < 13100:
        start_orphan = i
    if start_orphan is not None and end_orphan is None and "contenedor.appendChild(tarjeta)" in line and i > start_orphan:
        end_orphan = i + 1  # include this line
        # also include the }); line after it
        if i + 1 < len(lines) and '});' in lines[i+1]:
            end_orphan = i + 2
        break

if start_orphan is not None and end_orphan is not None:
    print(f"Removing orphaned lines {start_orphan+1} to {end_orphan} ({end_orphan-start_orphan} lines)")
    del lines[start_orphan:end_orphan]
    print(f"Total lines after: {len(lines)}")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("File saved successfully")
else:
    print(f"Block not found: start={start_orphan}, end={end_orphan}")
    # Show context around expected area
    for i in range(13050, 13065):
        if i < len(lines):
            print(f"L{i+1}: {lines[i][:80].strip()}")
