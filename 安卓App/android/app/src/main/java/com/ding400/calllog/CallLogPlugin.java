package com.ding400.calllog;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CallLog;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(
    name = "CallLogPlugin",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_CALL_LOG },
            alias = "callLog"
        )
    }
)
public class CallLogPlugin extends Plugin {

    private boolean hasCallLogPermission() {
        return ActivityCompat.checkSelfPermission(
                getContext(), Manifest.permission.READ_CALL_LOG)
                == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasCallLogPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        // 通过 Capacitor 内置权限流程发起系统弹窗，结果回调到 permissionCallback
        requestPermissionForAlias("callLog", call, "permissionCallback");
    }

    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasCallLogPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void getCallLogs(PluginCall call) {
        if (!hasCallLogPermission()) {
            call.reject("缺少读取通话记录权限，请先调用 requestPermission");
            return;
        }

        int limit = call.getInt("limit", 30);
        if (limit <= 0) limit = 30;

        JSArray logs = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        Uri uri = CallLog.Calls.CONTENT_URI;

        String[] projection = new String[]{
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.TYPE,
                CallLog.Calls.DURATION,
                CallLog.Calls.CACHED_NAME
        };

        // 只返回来电类型（incoming type = 1），因为这是记录接到的电话
        String selection = CallLog.Calls.TYPE + " = ?";
        String[] selectionArgs = new String[]{ String.valueOf(CallLog.Calls.INCOMING_TYPE) };
        String sortOrder = CallLog.Calls.DATE + " DESC LIMIT " + limit;

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault());

        Cursor cursor = null;
        try {
            cursor = resolver.query(uri, projection, selection, selectionArgs, sortOrder);
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String number = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER));
                    long dateMs = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE));
                    int type = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE));
                    long duration = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION));
                    String name = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME));

                    JSObject item = new JSObject();
                    item.put("number", number == null ? "" : number);
                    item.put("date", dateMs);
                    item.put("dateStr", sdf.format(new Date(dateMs)));
                    item.put("type", type);
                    item.put("typeName", typeName(type));
                    item.put("duration", duration);
                    item.put("name", name); // 可能为 null，前端已处理
                    logs.put(item);
                }
            }
        } catch (Exception e) {
            call.reject("查询通话记录失败：" + e.getMessage());
            return;
        } finally {
            if (cursor != null) cursor.close();
        }

        JSObject ret = new JSObject();
        ret.put("logs", logs);
        call.resolve(ret);
    }

    private String typeName(int type) {
        switch (type) {
            case CallLog.Calls.INCOMING_TYPE: return "来电";
            case CallLog.Calls.OUTGOING_TYPE: return "去电";
            case CallLog.Calls.MISSED_TYPE:   return "未接";
            default: return "其他";
        }
    }
}
