# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - heading "Library" [level=2] [ref=e5]
    - generic [ref=e6]:
      - heading "Map Settings" [level=3] [ref=e7]
      - generic [ref=e8]:
        - button "🗺️ Upload Map" [ref=e10] [cursor=pointer]:
          - generic [ref=e11]: 🗺️
          - text: Upload Map
        - generic [ref=e12]:
          - generic [ref=e13]: Grid Type
          - combobox [ref=e14]:
            - option "Lines" [selected]
            - option "Dots"
            - option "Hidden"
        - generic [ref=e15]:
          - heading "Calibration" [level=4] [ref=e17]
          - button "📐 Calibrate via Draw" [disabled] [ref=e18] [cursor=pointer]:
            - generic [ref=e19]: 📐
            - text: Calibrate via Draw
          - button "Reset Map" [disabled] [ref=e21]
    - generic [ref=e22]:
      - heading "Tokens" [level=3] [ref=e23]
      - generic [ref=e24]:
        - generic [ref=e25]: 🦁
        - generic [ref=e26]: 👽
  - generic [ref=e33]:
    - button "Select (V)" [ref=e34] [cursor=pointer]
    - button "Marker (M)" [ref=e35] [cursor=pointer]
    - button "Eraser (E)" [ref=e36] [cursor=pointer]
    - generic [ref=e38] [cursor=pointer]:
      - generic [ref=e39]: Color (I)
      - textbox "Color (I)" [ref=e40]: "#df4b26"
    - button "Save" [ref=e42] [cursor=pointer]
    - button "Load" [ref=e43] [cursor=pointer]
    - button "World View" [ref=e45] [cursor=pointer]
```