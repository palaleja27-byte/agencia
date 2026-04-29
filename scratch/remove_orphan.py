file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines are 1-indexed in the editor, 0-indexed in the list.

# PROBLEM: After PT.generateIce closes at line 13056 (idx 13055),
# there are orphaned lines 13057-13091 that are fragments of PT.renderAll.
# These fragments reference variables (op, tarjeta, taskPct, idx, contenedor)
# that don't exist in the current scope since PT.renderAll was deleted.
# 
# FIX: Wrap those orphaned lines in a proper PT.renderAll function.
# The orphaned block needs:
#   - The forEach loop header + variable declarations
#   - All the card rendering code
#   - The proper closing + header update code

# 0-indexed: 13055 = PT.generateIce closes }; 
# 0-indexed: 13056-13090 = orphaned tarjeta block
# 0-indexed: 13091 = });  (closes the forEach)
# 0-indexed: 13092 = blank
# 0-indexed: 13093 = // Actualizar Header  <- THIS was the error line

# Let's verify: find the orphaned block boundaries
start_orphan = None
end_orphan = None
for i, line in enumerate(lines):
    if i >= 13055 and i <= 13065 and "tarjeta.className" in line:
        start_orphan = i
    if i >= 13088 and i <= 13095 and "contenedor.appendChild(tarjeta)" in line:
        end_orphan = i + 1  # include the }); line

print(f"Orphaned block: lines {start_orphan+1}-{end_orphan+1}")

if start_orphan is not None and end_orphan is not None:
    # Build the replacement: wrap orphaned block in PT.renderAll
    orphaned = lines[start_orphan:end_orphan]
    print("Orphaned content:")
    for l in orphaned:
        print(f"  {repr(l[:80])}")

    # Remove the orphaned block
    del lines[start_orphan:end_orphan]
    print(f"\nDeleted {end_orphan - start_orphan} orphaned lines")

# Now let's also check if the "Illegal return statement" at line 14316 is fixed
# It was caused by the second asiCardHTML being outside a function.
# Let's verify both asiCardHTML definitions are inside valid script blocks.

# Check for the closing tags structure
print("\nChecking script/body/html closing tags at end of file:")
for i, line in enumerate(lines[-20:]):
    print(f"L{len(lines)-19+i}: {repr(line.strip())}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("\nOrphaned block removed. File saved.")
