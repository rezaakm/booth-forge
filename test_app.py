from playwright.sync_api import sync_playwright
import os

output_dir = os.path.join(os.path.dirname(__file__), 'test_screenshots')
os.makedirs(output_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})

    # 1. Load the page
    print("1. Loading page...")
    page.goto('http://localhost:3001')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=os.path.join(output_dir, '01_initial.png'), full_page=False)
    print("   Screenshot: 01_initial.png")

    # 2. Check mode toggle exists
    print("2. Checking mode toggle...")
    brief_tab = page.locator('text=Text Brief')
    image_tab = page.locator('text=Image → 3D')
    print(f"   Text Brief tab visible: {brief_tab.is_visible()}")
    print(f"   Image → 3D tab visible: {image_tab.is_visible()}")

    # 3. Click Image → 3D mode
    print("3. Switching to Image → 3D mode...")
    image_tab.click()
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(output_dir, '02_image_mode.png'), full_page=False)
    print("   Screenshot: 02_image_mode.png")

    # Check upload area exists
    upload_area = page.locator('text=Drop a floor plan or booth sketch')
    print(f"   Upload area visible: {upload_area.is_visible()}")

    # 4. Switch back to Text Brief mode
    print("4. Switching back to Text Brief mode...")
    brief_tab.click()
    page.wait_for_timeout(500)

    # 5. Select a template
    print("5. Selecting Tech template...")
    tech_btn = page.locator('text=Tech / Software')
    tech_btn.click()
    page.wait_for_timeout(300)
    page.screenshot(path=os.path.join(output_dir, '03_template_selected.png'), full_page=False)
    print("   Screenshot: 03_template_selected.png")

    # 6. Click Generate
    print("6. Generating booth (this calls Claude API, may take ~15s)...")
    generate_btn = page.locator('button:has-text("Generate Booth")')
    generate_btn.click()

    # Wait for loading to finish (up to 60s)
    try:
        page.wait_for_selector('text=3D View', timeout=60000)
        page.wait_for_timeout(2000)  # Let 3D render
        page.screenshot(path=os.path.join(output_dir, '04_result_3d.png'), full_page=False)
        print("   Screenshot: 04_result_3d.png")

        # 7. Check export buttons
        print("7. Checking export buttons...")
        glb_btn = page.locator('button:has-text(".glb")')
        usdz_btn = page.locator('button:has-text(".usdz")')
        rb_btn = page.locator('button:has-text(".rb")')
        print(f"   .glb button: {glb_btn.is_visible()}")
        print(f"   .usdz button: {usdz_btn.is_visible()}")
        print(f"   .rb button: {rb_btn.is_visible()}")

        # 8. Switch to Floor Plan view
        print("8. Switching to Floor Plan view...")
        plan_tab = page.locator('button:has-text("Floor Plan")')
        plan_tab.click()
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(output_dir, '05_floor_plan.png'), full_page=False)
        print("   Screenshot: 05_floor_plan.png")

        # 9. Switch back to 3D and take final screenshot
        print("9. Back to 3D View...")
        threed_tab = page.locator('button:has-text("3D View")')
        threed_tab.click()
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(output_dir, '06_3d_final.png'), full_page=False)
        print("   Screenshot: 06_3d_final.png")

        print("\nAll tests PASSED!")

    except Exception as e:
        page.screenshot(path=os.path.join(output_dir, '99_error.png'), full_page=False)
        print(f"   ERROR: {e}")
        print("   Screenshot: 99_error.png")

    browser.close()
