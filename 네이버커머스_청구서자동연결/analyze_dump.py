import json
from collections import defaultdict

def analyze_dump(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        products = json.load(f)
    
    analysis = {
        "product_names": set(),
        "option_groups": set(),
        "option_names": set(),
        "supplement_groups": set(),
        "supplement_names": set(),
        "rack_type_samples": defaultdict(list)
    }
    
    for p in products:
        name = p.get("name", "")
        analysis["product_names"].add(name)
        
        opt_info = p.get("detailAttribute", {}).get("optionInfo", {})
        
        # Option Groups (from simple or combination)
        group_names = opt_info.get("optionCombinationGroupNames", {})
        if group_names:
            for k, v in group_names.items():
                analysis["option_groups"].add(v)
        
        # Option Simple
        for opt in opt_info.get("optionSimple", []):
            analysis["option_groups"].add(opt.get("groupName", ""))
            analysis["option_names"].add(opt.get("name", ""))
            
        # Option Combinations
        for comb in opt_info.get("optionCombinations", []):
            for i in range(1, 4):
                val = comb.get(f"optionName{i}")
                if val:
                    analysis["option_names"].add(val)
                    
        # Supplement Products
        supp_info = p.get("detailAttribute", {}).get("supplementProductInfo", {})
        for supp in supp_info.get("supplementProducts", []):
            analysis["supplement_groups"].add(supp.get("groupName", ""))
            analysis["supplement_names"].add(supp.get("name", ""))
            
    # Convert sets to sorted lists for JSON output
    result = {k: sorted(list(v)) if isinstance(v, set) else v for k, v in analysis.items()}
    return result

if __name__ == "__main__":
    result = analyze_dump('products_full_dump.json')
    with open('analysis_results.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("Analysis complete. Results saved to analysis_results.json")
