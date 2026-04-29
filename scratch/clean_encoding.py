import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def clean_file():
    try:
        # Try reading with different encodings
        content = ""
        for enc in ['utf-8', 'latin-1', 'cp1252']:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    content = f.read()
                print(f"Read successful with {enc}")
                break
            except:
                continue
        
        if not content:
            print("Failed to read file with common encodings.")
            return

        # Replace common mangled chars if possible or just write back as clean utf-8
        # The mangled chars like Y' are usually artifacts of double encoding.
        # We will just write it back as clean UTF-8.
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("File rewritten as UTF-8.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    clean_file()
