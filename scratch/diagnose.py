import re

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

total = len(lines)
print(f"Total lines: {total}")

# PROBLEM 1: Around line 13056 (0-indexed: 13055)
# After PT.generateIce closes with }; on line 13056,
# the next lines (tarjeta.className...) are orphaned fragments 
# that belong inside PT.renderAll (which was split by the injection).
# 
# FIX: Wrap those orphaned lines with a proper PT.renderAll declaration.
# 
# The orphaned block is:
#   tarjeta.className = 'op-card';     (line 13057, idx 13056)
#   ... everything until ...
#   });                                 (line 13091, idx 13090)
#
# We need to insert: PT.renderAll = function() { ... const contenedor = ...; data.forEach(...)
# But since we don't have the full original function, the safest fix is to 
# WRAP the orphaned code in a self-contained PT.renderAll definition.
#
# ACTUALLY - let's look at what's around 13056 more carefully.
# Line 13056 (idx=13055) = "         };"  (closes PT.generateIce)
# Line 13057 (idx=13056) = "            tarjeta.className = 'op-card';"  <- ORPHANED

# Let's check what's at 13055-13056 (idx 13054-13055)
for i in range(13050, 13065):
    print(f"L{i+1}: {repr(lines[i])}")

print("\n--- Looking for renderAll ---")
for i, line in enumerate(lines):
    if 'renderAll' in line and '=' in line and 'function' in line:
        print(f"L{i+1}: {repr(line)}")
