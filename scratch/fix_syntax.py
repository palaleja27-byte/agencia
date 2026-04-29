import os
import re

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def fix_syntax_errors():
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix 1: Unclosed string in confirm (line ~5445)
    # We find the start of the confirm and replace " with `
    confirm_start = 'if (confirm("ǽs? \\\'CONSOLIDAR BRIDGE'
    confirm_start_alt = 'if (confirm("ǽ'
    
    # We will use regex to find the multiline confirm call
    # It looks like: if (confirm("... \n ... \n ...")) {
    content = re.sub(
        r'if \(confirm\("([^"]*?CONSOLIDAR BRIDGE[^"]*?)"\)\) \{',
        r'if (confirm(`\1`)) {',
        content,
        flags=re.DOTALL
    )

    # If the above fails due to encoding, let's try a broader regex for that specific block
    content = re.sub(
        r'if \(confirm\("([^\)]*?CONSOLIDAR BRIDGE.*?)"\)\) \{',
        r'if (confirm(`\1`)) {',
        content,
        flags=re.DOTALL
    )

    # Fix 2: Unclosed string in ICEBREAKERS_BANK (line ~13023)
    # "Dicen que los mejores secretos se cuentan en voz baja. 'Tie        PT.generateIce = async function(cat) {
    bad_icebreaker = r'"Dicen que los mejores secretos se cuentan en voz baja\.\s*\'Tie\s*PT\.generateIce'
    if re.search(bad_icebreaker, content):
        content = re.sub(
            bad_icebreaker,
            '"Dicen que los mejores secretos se cuentan en voz baja. \\\'Tienes algo que confesar?\\\'"\n          ]\n        };\n        PT.generateIce',
            content
        )
    # Alternative match if it has weird chars
    content = re.sub(
        r'("Dicen que los mejores secretos se cuentan en voz baja[^\n]*?)PT\.generateIce',
        r'\1"\n          ]\n        };\n        PT.generateIce',
        content
    )

    # Fix 3: Invalid regular expression (line ~14221)
    # const sn = name.replace(/\/g, '\').replace(/'/g, "\'");
    content = content.replace(
        "const sn = name.replace(/\//g, '\\').replace(/'/g, \"\\'\");",
        "const sn = name.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\");"
    )
    content = content.replace(
        "const sn = name.replace(/\\/g, '\\').replace(/'/g, \"\\'\");",
        "const sn = name.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\");"
    )
    content = content.replace(
        "const sn = name.replace(/\\/g, '\\\\').replace(/'/g, \"\\'\");",
        "const sn = name.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\");"
    )
    
    # Catch-all for the bad regex line
    content = re.sub(
        r"const sn = name\.replace\(\/\\\/g, '[^']*'\)\.replace\(\/'\/g, \"\\'\"\);",
        r"const sn = name.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\'\");",
        content
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Syntax fixes applied.")

if __name__ == "__main__":
    fix_syntax_errors()
