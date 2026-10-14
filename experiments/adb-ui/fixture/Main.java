package com.rea.ui.probe;

import android.app.Activity;
import android.content.ClipData;
import android.os.Bundle;
import android.view.DragEvent;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Self-owned UI oracle; it requests no permissions and performs no network I/O. */
public final class Main extends Activity {
  private int taps = 0;

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout layout = new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    EditText input = new EditText(this);
    input.setId(id("entry"));
    input.setSingleLine(true);
    input.setContentDescription("rea-input");
    layout.addView(input);
    Button button = new Button(this);
    button.setId(id("sign_in"));
    button.setText("Sign in");
    button.setAllCaps(false);
    button.setContentDescription("rea-tap");
    layout.addView(button);
    TextView status = new TextView(this);
    status.setContentDescription("rea-status");
    status.setId(id("status"));
    status.setText("Tapped 0");
    layout.addView(status);
    button.setOnClickListener(view -> status.setText("Tapped " + (++taps)));
    button.setOnLongClickListener(
        view -> {
          status.setText("Long pressed");
          return true;
        });
    LinearLayout duplicates = new LinearLayout(this);
    for (int index = 0; index < 2; index++) {
      final int selected = index;
      Button duplicate = new Button(this);
      duplicate.setAllCaps(false);
      duplicate.setText("Duplicate");
      duplicate.setId(id(index == 0 ? "duplicate_one" : "duplicate_two"));
      duplicate.setOnClickListener(view -> status.setText("Duplicate " + selected));
      duplicates.addView(duplicate, new LinearLayout.LayoutParams(0, -2, 1));
    }
    layout.addView(duplicates);
    Button disabled = new Button(this);
    disabled.setText("Disabled");
    disabled.setAllCaps(false);
    disabled.setEnabled(false);
    disabled.setId(id("disabled"));
    layout.addView(disabled);
    LinearLayout composite = new LinearLayout(this);
    composite.setId(id("composite"));
    composite.setClickable(true);
    composite.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
    composite.setPadding(20, 20, 20, 20);
    composite.setOnClickListener(view -> status.setText("Continued"));
    TextView label = new TextView(this);
    label.setText("Continue");
    label.setId(id("continue_label"));
    label.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
    composite.addView(label);
    layout.addView(composite);
    LinearLayout dragRow = new LinearLayout(this);
    Button source = new Button(this);
    source.setText("Drag");
    source.setAllCaps(false);
    source.setId(id("drag_source"));
    source.setOnLongClickListener(
        view ->
            view.startDragAndDrop(
                ClipData.newPlainText("fixture", "drag"),
                new View.DragShadowBuilder(view),
                null,
                0));
    Button destination = new Button(this);
    destination.setText("Drop");
    destination.setAllCaps(false);
    destination.setId(id("drag_destination"));
    destination.setOnDragListener(
        (view, event) -> {
          if (event.getAction() == DragEvent.ACTION_DROP) status.setText("Dropped");
          return true;
        });
    dragRow.addView(source, new LinearLayout.LayoutParams(0, -2, 1));
    dragRow.addView(destination, new LinearLayout.LayoutParams(0, -2, 1));
    layout.addView(dragRow);
    ScrollView scroll = new ScrollView(this);
    scroll.setContentDescription("rea-scroll");
    scroll.setId(id("scroll"));
    LinearLayout rows = new LinearLayout(this);
    rows.setOrientation(LinearLayout.VERTICAL);
    for (int index = 0; index < 40; index++) {
      TextView row = new TextView(this);
      row.setText("Row " + index);
      row.setTextSize(24);
      row.setPadding(8, 20, 8, 20);
      rows.addView(row);
    }
    scroll.addView(rows);
    layout.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    setContentView(layout);
  }

  private int id(String name) {
    return getResources().getIdentifier(name, "id", getPackageName());
  }
}
