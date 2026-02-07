
filename = r"c:\Users\PatrikWagner\OneDrive - ABU DHABI EQUESTRIAN CLUB\Desktop\OG_profitability\OGLight.user.js"
with open(filename, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if "11201" in line:
            print(f"Found at line {i+1}: {line.strip()[:100]}...")
