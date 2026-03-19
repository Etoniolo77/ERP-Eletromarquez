
import requests
import json

def test_api():
    base_url = "http://localhost:8000/api/v1"
    try:
        # Check if server is up
        r = requests.get(f"{base_url}/frota/dashboard?periodo=month&sector=CCM")
        data = r.json()
        print("--- Dashboard (Sector: CCM) ---")
        print(f"Matrix length: {len(data['matrix'])}")
        for m in data['matrix'][:5]:
            print(m)
            
        r_evo = requests.get(f"{base_url}/frota/evolucao-medio?periodo=month&compare=regional&sector=CCM")
        data_evo = r_evo.json()
        print("\n--- Evolucao (Sector: CCM) ---")
        print(data_evo[:2])

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
