<?php
/**
 * Lovelace — кастомная панель управления умным домом (модуль Majordomo).
 *
 * API — штатным маршрутом api.php/module/lovelace/<op> (метод api($params)),
 * страница — как dashboard_pro. Раскладка в БД на пользователя (lovelace_config).
 *
 * @package MajorDoMo
 * @version 1.0
 */
class lovelace extends module
{
    var $config;
    private $tokenRow = null;   // запись токена настенного устройства (если доступ по токену)

    private $AUTODISCOVER      = false;
    private $AUTO_SWITCH_PROPS = array('status', 'state', 'power', 'switch');
    private $AUTO_SENSOR_PROPS = array('temperature', 'humidity', 'value', 'battery');

    private $WRITE   = array();
    private $METHODS = array();

    function __construct()
    {
        $this->name            = 'lovelace';
        $this->title           = 'Lovelace';
        $this->module_category = '<#LANG_SECTION_APPLICATIONS#>';
        $this->checkInstalled();
    }

    function getParams() {}
    function saveParams($data = 0) { return parent::saveParams(array()); }

    /* =====================================================================
     *  СТРАНИЦА (как dashboard_pro: просто рендер, авторизацию даёт ядро)
     * ===================================================================== */
    function run()
    {
        $out = array();
        if ($this->action == 'admin') { $this->admin($out); } else { $this->usual($out); }
        $this->data = $out;
        $p = new parser(DIR_TEMPLATES . $this->name . '/' . $this->name . '.html', $this->data, $this);
        $this->result = $p->result;
    }

    function usual(&$out)
    {
        global $session;
        $out['API_BASE'] = ROOTHTML . 'api.php/module/lovelace/';
        $out['USER_ID']  = (int)(isset($session->data['SITE_USER_ID']) ? $session->data['SITE_USER_ID'] : 0);
        $out['IS_ADMIN'] = $this->lvlIsAdmin() ? 1 : 0;
        $out['WS_PORT']  = defined('WEBSOCKETS_PORT') ? WEBSOCKETS_PORT : 8001;
        $out['WS_PATH']  = '/majordomo';
        $out['WS_OFF']   = defined('DISABLE_WEBSOCKETS') ? 1 : 0;
    }

    function admin(&$out)
    {
        $this->getConfig();
        if (gr('save_settings')) {
            $this->config['WS_URL'] = trim((string)gr('ws_url'));
            $this->saveConfig();
            $out['SAVED'] = 1;
        }
        $out['WS_URL'] = htmlspecialchars(isset($this->config['WS_URL']) ? $this->config['WS_URL'] : '');
        $out['ADMIN'] = 1;
    }

    /* =====================================================================
     *  API (api.php/module/lovelace/<op>) — возвращает массивы
     * ===================================================================== */
    function api($params)
    {
        global $session, $op;
        if (!$session) $session = new session('prj');
        if (function_exists('SQLExec')) @SQLExec("SET NAMES utf8mb4");   // эмодзи в названиях (4-байтовый UTF-8)

        // объединяем query-параметры + JSON-тело (для GET c ?object= и POST-операций)
        if (is_array($_GET)) $params = array_merge($_GET, $params);
        $body = json_decode(file_get_contents('php://input'), true);
        if (is_array($body)) $params = array_merge($body, $params);

        $req = isset($params['request'][0]) ? $params['request'][0] : 'state';

        // kiosk-токен из URL — ВЫСШИЙ приоритет (перекрывает сессию и dev)
        $this->tokenRow = null;
        $tok = isset($params['token']) ? trim((string)$params['token']) : '';
        if ($tok !== '') $this->tokenRow = $this->findToken($tok);

        // персональный токен устройства ("запомнить меня"): только если НЕТ kiosk-токена
        // и нет сессии — тогда восстанавливаем SITE_USER_ID в сессию.
        if (!$this->tokenRow && !$this->authed()) {
            $dev = isset($params['dev']) ? trim((string)$params['dev']) : '';
            if ($dev !== '') $this->deviceLogin($dev);
        }

        // статус авторизации — доступен без входа
        if ($req == 'checkAuth') {
            if ($this->tokenRow) return array('authenticated' => true, 'token' => 1, 'can_control' => (int)$this->tokenRow['CAN_CONTROL'], 'is_admin' => 0, 'user' => (int)$this->tokenRow['USER_ID']);
            if ($this->authed()) return array('authenticated' => true, 'is_admin' => $this->lvlIsAdmin() ? 1 : 0, 'user' => $this->currentUserId());
            return array('authenticated' => false, 'is_admin' => 0);
        }

        // доступ: токен ИЛИ сессия
        if (!$this->tokenRow && !$this->authed()) return array('error' => 'auth', 'authenticated' => false);

        $this->getConfig();   // настройки модуля ($this->config), в т.ч. WS_URL

        // ===== РЕЖИМ ТОКЕНА (kiosk из URL): ПРИОРИТЕТ над сессией =====
        if ($this->tokenRow) {
            $this->touchToken((int)$this->tokenRow['ID']);
            $cfg   = $this->effectiveConfig();               // раскладка привязанного пользователя
            $rooms = isset($cfg['rooms']) ? $cfg['rooms'] : array();
            $this->buildWhitelists($rooms);
            switch ($req) {
                case 'settings': return array('ok' => true, 'ws_url' => $this->wsUrl(), 'is_admin' => 0);
                case 'prefs':    return array('ok' => true, 'prefs' => array());          // тема на устройстве
                case 'state':    return $this->apiState($cfg, $rooms);
                case 'config':   return array('ok' => true, 'config' => $cfg, 'user' => (int)$this->tokenRow['USER_ID'], 'is_admin' => 0);
                case 'calendar': return $this->apiCalendarList();                          // только просмотр
                case 'set':      if (!$this->tokenRow['CAN_CONTROL']) return array('error' => 'Токен только для просмотра'); return $this->apiSet($params);
                case 'method':   if (!$this->tokenRow['CAN_CONTROL']) return array('error' => 'Токен только для просмотра'); return $this->apiMethod($params);
            }
            return array('error' => 'Недоступно с токеном: ' . $req);
        }

        // ===== ОБЫЧНЫЙ РЕЖИМ (сессия) =====
        // настройки панели (WS-адрес) + опционально выдать персональный токен устройства
        if ($req == 'settings') {
            $out = array('ok' => true, 'ws_url' => $this->wsUrl(), 'is_admin' => $this->lvlIsAdmin() ? 1 : 0, 'uid' => $this->currentUserId());
            if (!empty($params['want_dev'])) {
                $uid = $this->currentUserId();
                if ($uid > 0) {
                    $tok = md5(uniqid(mt_rand(), true)) . md5(uniqid(mt_rand(), true));
                    $rec = array('TOKEN' => $tok, 'USER_ID' => $uid, 'CREATED' => time(), 'EXPIRES' => time() + 30 * 24 * 3600, 'LAST_SEEN' => time());
                    SQLInsert('lovelace_devices', $rec);
                    $out['dev'] = $tok;
                }
            }
            return $out;
        }
        if ($req == 'savesettings') {
            if (!$this->lvlIsAdmin()) return array('error' => 'Только для администратора');
            $this->config['WS_URL'] = isset($params['ws_url']) ? trim((string)$params['ws_url']) : '';
            $this->saveConfig();
            return array('ok' => true, 'ws_url' => $this->wsUrl());
        }
        // предпочтения пользователя (тема и т.п.)
        if ($req == 'prefs') {
            return array('ok' => true, 'prefs' => $this->getPrefs($this->currentUserId()));
        }
        if ($req == 'saveprefs') {
            $prefs = isset($params['prefs']) && is_array($params['prefs']) ? $params['prefs'] : array();
            $this->savePrefs($this->currentUserId(), $prefs);
            return array('ok' => true);
        }
        // "забыть устройство": удалить конкретный персональный токен из БД
        if ($req == 'device_forget') {
            $dev = isset($params['dev']) ? trim((string)$params['dev']) : '';
            if ($dev !== '') {
                $safe = function_exists('DBSafe') ? DBSafe($dev) : addslashes($dev);
                SQLExec("DELETE FROM lovelace_devices WHERE TOKEN='" . $safe . "'");
            }
            return array('ok' => true);
        }
        // управление токенами (только админ)
        if ($req == 'users') {
            if (!$this->lvlIsAdmin()) return array('error' => 'Только для администратора');
            return array('ok' => true, 'users' => $this->usersList());
        }
        if ($req == 'tokens') {
            if (!$this->lvlIsAdmin()) return array('error' => 'Только для администратора');
            return array('ok' => true, 'tokens' => $this->tokensList());
        }
        if ($req == 'token_create') {
            if (!$this->lvlIsAdmin()) return array('error' => 'Только для администратора');
            return $this->tokenCreate($params);
        }
        if ($req == 'token_revoke') {
            if (!$this->lvlIsAdmin()) return array('error' => 'Только для администратора');
            $id = isset($params['id']) ? (int)$params['id'] : 0;
            if ($id > 0) SQLExec("DELETE FROM lovelace_tokens WHERE ID=" . $id);
            return array('ok' => true);
        }

        // белые списки из эффективной раскладки (нужны для set/method/state)
        $cfg   = $this->effectiveConfig();
        $rooms = isset($cfg['rooms']) ? $cfg['rooms'] : array();
        $this->buildWhitelists($rooms);

        switch ($req) {
            case 'state':      return $this->apiState($cfg, $rooms);
            case 'set':        return $this->apiSet($params);
            case 'method':     return $this->apiMethod($params);
            case 'objects':    return $this->apiObjects();
            case 'properties': return $this->apiProperties($params);
            case 'discover':   return array('ok' => true, 'rooms' => $this->discoverRooms());
            case 'objectinfo': return $this->apiObjectInfo($params);
            case 'config':     return $this->apiConfig($params);
            case 'save':       return $this->apiSave($params);
            case 'calendar':   return $this->apiCalendar($params);
        }
        return array('error' => 'Unknown API endpoint: ' . $req);
    }

    /* ---------- токены настенных устройств ---------- */

    private function usersList()
    {
        $rows = SQLSelect("SELECT ID, USERNAME, NAME FROM users ORDER BY USERNAME");
        if (!is_array($rows)) $rows = array();
        // у кого есть своя раскладка
        $has = array();
        $cr = SQLSelect("SELECT DISTINCT USER_ID FROM lovelace_config WHERE NAME='default'");
        if (is_array($cr)) foreach ($cr as $r) $has[(int)$r['USER_ID']] = 1;
        $out = array();
        $out[] = array('id' => 0, 'login' => '— общая раскладка —', 'has_layout' => isset($has[0]) ? 1 : 0);
        foreach ($rows as $r) {
            $nm = ($r['NAME'] !== null && $r['NAME'] !== '') ? $r['NAME'] : $r['USERNAME'];
            if ($nm === null || $nm === '') $nm = '#' . $r['ID'];
            $out[] = array('id' => (int)$r['ID'], 'login' => $nm, 'has_layout' => isset($has[(int)$r['ID']]) ? 1 : 0);
        }
        return $out;
    }

    /** вход по персональному токену устройства: восстановить SITE_USER_ID в сессию (В1) */
    private function deviceLogin($tok)
    {
        global $session;
        $safe = function_exists('DBSafe') ? DBSafe($tok) : addslashes($tok);
        $row = SQLSelectOne("SELECT * FROM lovelace_devices WHERE TOKEN='" . $safe . "'");
        if (!$row || !isset($row['ID'])) return false;
        // истёк — удаляем
        if ((int)$row['EXPIRES'] > 0 && (int)$row['EXPIRES'] < time()) {
            SQLExec("DELETE FROM lovelace_devices WHERE ID=" . (int)$row['ID']);
            return false;
        }
        // пользователь ещё существует?
        $u = SQLSelectOne("SELECT ID FROM users WHERE ID=" . (int)$row['USER_ID']);
        if (!$u || !isset($u['ID'])) {
            SQLExec("DELETE FROM lovelace_devices WHERE ID=" . (int)$row['ID']);
            return false;
        }
        // восстановить сессию + скользящее продление (30 дней)
        $session->data['SITE_USER_ID'] = (int)$row['USER_ID'];
        if (method_exists($session, 'save')) $session->save();
        SQLExec("UPDATE lovelace_devices SET EXPIRES=" . (time() + 30 * 24 * 3600) . ", LAST_SEEN=" . time() . " WHERE ID=" . (int)$row['ID']);
        return true;
    }

    private function findToken($tok)
    {
        $safe = function_exists('DBSafe') ? DBSafe($tok) : addslashes($tok);
        $row = SQLSelectOne("SELECT * FROM lovelace_tokens WHERE TOKEN='" . $safe . "'");
        return ($row && isset($row['ID'])) ? $row : null;
    }

    private function touchToken($id)
    {
        SQLExec("UPDATE lovelace_tokens SET LAST_SEEN=" . time() . " WHERE ID=" . (int)$id);
    }

    private function tokensList()
    {
        $rows = SQLSelect("SELECT ID, TOKEN, TITLE, USER_ID, CAN_CONTROL, CREATED, LAST_SEEN FROM lovelace_tokens ORDER BY CREATED DESC");
        return is_array($rows) ? $rows : array();
    }

    private function tokenCreate($params)
    {
        $title = isset($params['title']) ? mb_substr(trim((string)$params['title']), 0, 100) : '';
        if ($title === '') $title = 'Устройство';
        $userId = isset($params['user']) ? (int)$params['user'] : 0;
        $canControl = (isset($params['can_control']) && ($params['can_control'] == 1 || $params['can_control'] === true || $params['can_control'] === '1')) ? 1 : 0;
        if (function_exists('random_bytes')) $tok = bin2hex(random_bytes(24));
        else $tok = md5(uniqid(mt_rand(), true)) . md5(uniqid(mt_rand(), true));
        $rec = array('TOKEN' => $tok, 'TITLE' => $title, 'USER_ID' => $userId, 'CAN_CONTROL' => $canControl, 'CREATED' => time(), 'LAST_SEEN' => 0);
        SQLInsert('lovelace_tokens', $rec);
        return array('ok' => true, 'token' => $tok, 'title' => $title);
    }

    /** режим показа: для токена — его пользователь, иначе текущий из сессии */
    private function viewUserId()
    {
        if ($this->tokenRow) return (int)$this->tokenRow['USER_ID'];   // kiosk-токен приоритетнее
        return $this->currentUserId();
    }

    /* ---------- операции ---------- */

    private function apiState($cfg, $rooms)
    {
        $mode  = ($this->getLayout($this->viewUserId()) !== null) ? 'config' : ($this->AUTODISCOVER ? 'auto' : 'manual');
        $title = isset($cfg['title']) ? (string)$cfg['title'] : '';
        $hide  = isset($cfg['hideAllTab']) ? (bool)$cfg['hideAllTab'] : false;
        $outRooms = array();
        foreach ($rooms as $room) {
            $devices = array();
            foreach ($room['devices'] as $dev) {
                $controls = array();
                foreach ($dev['controls'] as $c) {
                    $t = isset($c['type']) ? $c['type'] : 'text';
                    $oid = $dev['id'];
                    if (isset($c['reads']) && is_array($c['reads'])) {
                        $vals = array();
                        foreach ($c['reads'] as $rp) $vals[$rp] = gg($oid . '.' . $rp);
                        $c['values'] = $vals;
                    } elseif ($t === 'thermostat') {
                        if (isset($c['current'])) $c['current_value'] = gg($oid . '.' . $c['current']);
                        if (isset($c['target']))  $c['target_value']  = gg($oid . '.' . $c['target']);
                    } elseif ($t === 'cover') {
                        if (isset($c['state'])) $c['state_value'] = gg($oid . '.' . $c['state']);
                    } elseif ($t === 'rgb') {
                        if (isset($c['power'])) $c['power_value'] = gg($oid . '.' . $c['power']);
                        if (isset($c['color'])) $c['color_value'] = gg($oid . '.' . $c['color']);
                    } elseif ($t === 'camera') {
                        if (isset($c['image_prop'])) $c['image'] = gg($oid . '.' . $c['image_prop']);
                    } elseif ($t === 'button') {
                        // no value
                    } else {
                        $c['value'] = isset($c['prop']) ? gg($oid . '.' . $c['prop']) : '';
                    }
                    if (!isset($c['readonly'])) $c['readonly'] = false;
                    $controls[] = $c;
                }
                $devObj = array('id' => $dev['id'], 'title' => isset($dev['title']) ? $dev['title'] : $dev['id'], 'icon' => isset($dev['icon']) ? $dev['icon'] : 'dot', 'controls' => $controls);
                if (isset($dev['w'])) $devObj['w'] = $dev['w'];
                if (isset($dev['h'])) $devObj['h'] = $dev['h'];
                if (!empty($dev['id'])) {
                    $al = gg($dev['id'] . '.alive');
                    if ($this->hasValue($al)) $devObj['alive'] = (in_array((string)$al, array('1', 'on', 'true', 'yes'), true) || $al === 1 || $al === true) ? 1 : 0;
                }
                $devices[] = $devObj;
            }
            $outRooms[] = array('id' => $room['id'], 'title' => $room['title'], 'devices' => $devices);
        }
        return array('ok' => true, 'ts' => time(), 'mode' => $mode, 'title' => $title, 'hideAllTab' => $hide, 'ws_url' => $this->wsUrl(), 'rooms' => $outRooms);
    }

    private function wsUrl()
    {
        return (isset($this->config['WS_URL']) && $this->config['WS_URL'] !== '') ? $this->config['WS_URL'] : '';
    }

    private function getPrefs($userId)
    {
        $row = SQLSelectOne("SELECT PREFS FROM lovelace_config WHERE USER_ID=" . (int)$userId . " AND NAME='default'");
        if ($row && isset($row['PREFS']) && $row['PREFS'] !== '') {
            $p = json_decode($row['PREFS'], true);
            if (is_array($p)) return $p;
        }
        return array();
    }

    private function savePrefs($userId, $prefs)
    {
        $json = json_encode($prefs, JSON_UNESCAPED_UNICODE);
        $row = SQLSelectOne("SELECT ID FROM lovelace_config WHERE USER_ID=" . (int)$userId . " AND NAME='default'");
        if ($row && isset($row['ID'])) {
            SQLUpdate('lovelace_config', array('ID' => $row['ID'], 'PREFS' => $json, 'UPDATED' => time()));
        } else {
            $rec = array('USER_ID' => (int)$userId, 'NAME' => 'default', 'DATA' => '', 'PREFS' => $json, 'UPDATED' => time());
            SQLInsert('lovelace_config', $rec);
        }
    }

    private function apiSet($params)
    {
        $object   = isset($params['object'])   ? trim($params['object'])   : '';
        $property = isset($params['property']) ? trim($params['property']) : '';
        $value    = isset($params['value'])    ? $params['value']          : null;
        $addr = $object . '.' . $property;
        if (!isset($this->WRITE[$addr])) return array('error' => 'Запись не разрешена: ' . $addr);
        $spec = $this->WRITE[$addr];
        if ($spec['coerce'] === 'bool') {
            $value = ($value == 1 || $value === '1' || $value === true || $value === 'on') ? 1 : 0;
        } elseif ($spec['coerce'] === 'num') {
            $value = is_numeric($value) ? 0 + $value : 0;
            if (isset($spec['min']) && $spec['min'] !== null && $value < $spec['min']) $value = $spec['min'];
            if (isset($spec['max']) && $spec['max'] !== null && $value > $spec['max']) $value = $spec['max'];
        }
        sg($addr, $value, 0, 'lovelace');
        return array('ok' => true, 'value' => $value);
    }

    private function apiMethod($params)
    {
        $object = isset($params['object']) ? trim($params['object']) : '';
        $method = isset($params['method']) ? trim($params['method']) : '';
        $addr = $object . '.' . $method;
        if (empty($this->METHODS[$addr])) return array('error' => 'Метод не разрешён: ' . $addr);
        if (function_exists('callMethod')) { callMethod($addr, array()); return array('ok' => true); }
        return array('error' => 'callMethod недоступен');
    }

    private function apiObjects()
    {
        $rows = SQLSelect("SELECT ID, TITLE, DESCRIPTION, LOCATION_ID FROM objects ORDER BY TITLE");
        if (!is_array($rows)) $rows = array();
        $list = array();
        foreach ($rows as $r) {
            $desc = ($r['DESCRIPTION'] !== null && $r['DESCRIPTION'] !== '') ? $r['DESCRIPTION'] : $r['TITLE'];
            $list[] = array('id' => $r['TITLE'], 'title' => $desc, 'location' => (int)$r['LOCATION_ID']);
        }
        return array('ok' => true, 'objects' => $list);
    }

    private function apiProperties($params)
    {
        $objname = isset($params['object']) ? trim($params['object']) : '';
        $safe = function_exists('DBSafe') ? DBSafe($objname) : addslashes($objname);
        $row = SQLSelectOne("SELECT ID, CLASS_ID FROM objects WHERE TITLE='" . $safe . "'");
        if (!$row) return array('ok' => true, 'properties' => array());
        $classes = $this->classChain((int)$row['CLASS_ID']);
        $where = "OBJECT_ID=" . (int)$row['ID'];
        if (count($classes)) $where .= " OR (OBJECT_ID=0 AND CLASS_ID IN (" . implode(',', $classes) . "))";
        $prows = SQLSelect("SELECT DISTINCT TITLE FROM properties WHERE (" . $where . ") ORDER BY TITLE");
        if (!is_array($prows)) $prows = array();
        $props = array();
        foreach ($prows as $p) if ($p['TITLE'] !== '') $props[] = $p['TITLE'];
        return array('ok' => true, 'properties' => $props);
    }

    private function apiObjectInfo($params)
    {
        $objname = isset($params['object']) ? trim($params['object']) : '';
        $safe = function_exists('DBSafe') ? DBSafe($objname) : addslashes($objname);
        $row = SQLSelectOne("SELECT ID, CLASS_ID, DESCRIPTION FROM objects WHERE TITLE='" . $safe . "'");
        if (!$row) return array('ok' => true, 'title' => $objname, 'properties' => array());
        $classes = $this->classChain((int)$row['CLASS_ID']);
        $where = "OBJECT_ID=" . (int)$row['ID'];
        if (count($classes)) $where .= " OR (OBJECT_ID=0 AND CLASS_ID IN (" . implode(',', $classes) . "))";
        $prows = SQLSelect("SELECT TITLE, MAX(KEEP_HISTORY) AS KH FROM properties WHERE (" . $where . ") GROUP BY TITLE ORDER BY TITLE");
        if (!is_array($prows)) $prows = array();
        $props = array();
        foreach ($prows as $p) {
            if ($p['TITLE'] === '') continue;
            $props[] = array('name' => $p['TITLE'], 'value' => gg($objname . '.' . $p['TITLE']), 'history' => ((int)$p['KH'] !== 0));
        }
        $title = ($row['DESCRIPTION'] !== null && $row['DESCRIPTION'] !== '') ? $row['DESCRIPTION'] : $objname;
        return array('ok' => true, 'title' => $title, 'properties' => $props);
    }

    private function apiConfig($params)
    {
        $target = $this->targetUserId($params);
        $cfg = $this->getLayout($target);
        if ($cfg === null) $cfg = array('rooms' => $this->AUTODISCOVER ? $this->discoverRooms() : array());
        return array('ok' => true, 'config' => $cfg, 'user' => $target, 'is_admin' => $this->lvlIsAdmin() ? 1 : 0);
    }

    private function apiSave($params)
    {
        $target = $this->targetUserId($params);
        if ($target !== $this->currentUserId() && !$this->lvlIsAdmin()) return array('error' => 'Недостаточно прав для правки чужой раскладки');
        if (!isset($params['rooms']) || !is_array($params['rooms'])) return array('error' => 'Ожидался объект {"rooms":[...]}');
        $clean = array('rooms' => array());
        if (isset($params['title']))      $clean['title'] = mb_substr(trim((string)$params['title']), 0, 80);
        if (isset($params['hideAllTab'])) $clean['hideAllTab'] = (bool)$params['hideAllTab'];
        foreach ($params['rooms'] as $room) {
            if (!isset($room['devices']) || !is_array($room['devices'])) continue;
            $clean['rooms'][] = $room;
        }
        $this->saveLayout($target, $clean);
        return array('ok' => true, 'rooms' => count($clean['rooms']), 'user' => $target);
    }

    private function apiCalendar($params)
    {
        $sub = isset($params['op']) ? $params['op'] : '';
        $safe = function ($s) { return function_exists('DBSafe') ? DBSafe($s) : addslashes($s); };
        if ($sub === 'delete') {
            $id = isset($params['id']) ? (string)$params['id'] : '';
            if ($id !== '') SQLExec("DELETE FROM lovelace_calendar WHERE EVID='" . $safe($id) . "'");
        } elseif ($sub === 'add' || $sub === 'update') {
            $date = isset($params['date']) ? preg_replace('/[^0-9\-]/', '', (string)$params['date']) : '';
            if ($date === '') return array('error' => 'Нужна дата (YYYY-MM-DD)');
            $title = isset($params['title']) ? mb_substr(trim((string)$params['title']), 0, 200) : '';
            if ($title === '') return array('error' => 'Нужен заголовок события');
            $rec = array(
                'EDATE'   => $date,
                'ETIME'   => isset($params['time'])  ? preg_replace('/[^0-9:]/', '', (string)$params['time']) : '',
                'TITLE'   => $title,
                'NOTE'    => isset($params['note'])  ? mb_substr(trim((string)$params['note']), 0, 1000) : '',
                'COLOR'   => isset($params['color']) ? substr(preg_replace('/[^#0-9a-fA-F]/', '', (string)$params['color']), 0, 7) : '',
                'UPDATED' => time(),
            );
            $evid = (isset($params['id']) && $params['id'] !== '') ? (string)$params['id'] : '';
            if ($evid !== '') {
                $row = SQLSelectOne("SELECT ID FROM lovelace_calendar WHERE EVID='" . $safe($evid) . "'");
                $rec['EVID'] = $evid;
                if ($row && isset($row['ID'])) { $rec['ID'] = $row['ID']; SQLUpdate('lovelace_calendar', $rec); }
                else SQLInsert('lovelace_calendar', $rec);
            } else {
                $rec['EVID'] = 'e' . time() . substr(md5(mt_rand()), 0, 4);
                SQLInsert('lovelace_calendar', $rec);
            }
        }
        $rows = SQLSelect("SELECT EVID, EDATE, ETIME, TITLE, NOTE, COLOR FROM lovelace_calendar ORDER BY EDATE, ETIME");
        if (!is_array($rows)) $rows = array();
        $events = array();
        foreach ($rows as $r) {
            $events[] = array('id' => $r['EVID'], 'date' => $r['EDATE'], 'time' => $r['ETIME'], 'title' => $r['TITLE'], 'note' => $r['NOTE'], 'color' => $r['COLOR']);
        }
        return array('ok' => true, 'events' => $events);
    }

    private function apiCalendarList()
    {
        $rows = SQLSelect("SELECT EVID, EDATE, ETIME, TITLE, NOTE, COLOR FROM lovelace_calendar ORDER BY EDATE, ETIME");
        if (!is_array($rows)) $rows = array();
        $events = array();
        foreach ($rows as $r) {
            $events[] = array('id' => $r['EVID'], 'date' => $r['EDATE'], 'time' => $r['ETIME'], 'title' => $r['TITLE'], 'note' => $r['NOTE'], 'color' => $r['COLOR']);
        }
        return array('ok' => true, 'events' => $events);
    }

    /* =====================================================================
     *  AUTH / ACCESS
     * ===================================================================== */
    private function authed()
    {
        global $session;
        return !empty($session->data['SITE_USER_ID']);
    }

    private function lvlIsAdmin()
    {
        global $session;
        $uid = (int)(isset($session->data['SITE_USER_ID']) ? $session->data['SITE_USER_ID'] : 0);
        if ($uid <= 0) return false;
        $u = SQLSelectOne("SELECT IS_ADMIN FROM users WHERE ID=" . $uid);
        return ($u && !empty($u['IS_ADMIN']));
    }

    private function currentUserId()
    {
        global $session;
        return (int)(isset($session->data['SITE_USER_ID']) ? $session->data['SITE_USER_ID'] : 0);
    }

    private function targetUserId($params)
    {
        if ($this->lvlIsAdmin() && isset($params['user']) && $params['user'] !== '') return (int)$params['user'];
        return $this->currentUserId();
    }

    /* =====================================================================
     *  ХРАНИЛИЩЕ РАСКЛАДКИ (lovelace_config)
     * ===================================================================== */
    private function getLayout($userId)
    {
        $row = SQLSelectOne("SELECT DATA FROM lovelace_config WHERE USER_ID=" . (int)$userId . " AND NAME='default'");
        if (!$row && (int)$userId !== 0) $row = SQLSelectOne("SELECT DATA FROM lovelace_config WHERE USER_ID=0 AND NAME='default'");
        if ($row && isset($row['DATA']) && $row['DATA'] !== '') {
            $c = json_decode($row['DATA'], true);
            if (is_array($c) && isset($c['rooms'])) return $c;
        }
        return null;
    }

    private function saveLayout($userId, $config)
    {
        $json = json_encode($config, JSON_UNESCAPED_UNICODE);
        if ($json === false) return;
        $row = SQLSelectOne("SELECT ID FROM lovelace_config WHERE USER_ID=" . (int)$userId . " AND NAME='default'");
        $rec = array('USER_ID' => (int)$userId, 'NAME' => 'default', 'DATA' => $json, 'UPDATED' => time());
        if ($row && isset($row['ID'])) { $rec['ID'] = $row['ID']; SQLUpdate('lovelace_config', $rec); }
        else SQLInsert('lovelace_config', $rec);
    }

    private function effectiveConfig()
    {
        $cfg = $this->getLayout($this->viewUserId());
        if ($cfg !== null) return $cfg;
        if ($this->AUTODISCOVER) return array('rooms' => $this->discoverRooms());
        return array('rooms' => array());
    }

    /* =====================================================================
     *  ХЕЛПЕРЫ
     * ===================================================================== */
    private function buildWhitelists($rooms)
    {
        $this->WRITE = array(); $this->METHODS = array();
        foreach ($rooms as $room) {
            if (!isset($room['devices'])) continue;
            foreach ($room['devices'] as $dev) {
                $oid = $dev['id'];
                foreach ($dev['controls'] as $c) {
                    $t = isset($c['type']) ? $c['type'] : 'text';
                    if ($t === 'switch' && isset($c['prop'])) {
                        $this->WRITE[$oid . '.' . $c['prop']] = array('coerce' => 'bool');
                    } elseif ($t === 'slider' && isset($c['prop'])) {
                        $this->WRITE[$oid . '.' . $c['prop']] = array('coerce' => 'num', 'min' => isset($c['min']) ? $c['min'] : null, 'max' => isset($c['max']) ? $c['max'] : null);
                    } elseif ($t === 'thermostat' && isset($c['target'])) {
                        $this->WRITE[$oid . '.' . $c['target']] = array('coerce' => 'num', 'min' => isset($c['min']) ? $c['min'] : null, 'max' => isset($c['max']) ? $c['max'] : null);
                    } elseif ($t === 'rgb') {
                        if (isset($c['power'])) $this->WRITE[$oid . '.' . $c['power']] = array('coerce' => 'bool');
                        if (isset($c['color'])) $this->WRITE[$oid . '.' . $c['color']] = array('coerce' => 'raw');
                    }
                    if ($t === 'button' && isset($c['method'])) $this->METHODS[$oid . '.' . $c['method']] = true;
                    if ($t === 'cover' && isset($c['actions']) && is_array($c['actions'])) {
                        foreach ($c['actions'] as $act) if (isset($act['method'])) $this->METHODS[$oid . '.' . $act['method']] = true;
                    }
                    if (isset($c['writes']) && is_array($c['writes'])) foreach ($c['writes'] as $wp) $this->WRITE[$oid . '.' . $wp] = array('coerce' => 'raw');
                    if (isset($c['methods']) && is_array($c['methods'])) foreach ($c['methods'] as $mm) $this->METHODS[$oid . '.' . $mm] = true;
                }
            }
        }
    }

    private function classChain($cid)
    {
        $classes = array(); $g = 0;
        while ($cid > 0 && $g < 20) {
            $classes[] = $cid;
            $cr = SQLSelectOne("SELECT PARENT_ID FROM classes WHERE ID=" . (int)$cid);
            $cid = ($cr && isset($cr['PARENT_ID'])) ? (int)$cr['PARENT_ID'] : 0;
            $g++;
        }
        return $classes;
    }

    private function guessIcon($controls)
    {
        foreach ($controls as $c) {
            $p = strtolower($c['prop']);
            if (strpos($p, 'temp') !== false) return 'thermo';
            if (strpos($p, 'hum') !== false) return 'droplet';
            if (strpos($p, 'motion') !== false || strpos($p, 'presence') !== false) return 'motion';
        }
        foreach ($controls as $c) if ($c['type'] === 'switch') return 'bulb';
        return 'dot';
    }

    private function discoverRooms()
    {
        $rooms = array();
        $locs = SQLSelect("SELECT ID, TITLE, PRIORITY FROM locations ORDER BY PRIORITY, TITLE");
        if (!is_array($locs) || !count($locs)) return $rooms;
        $objs = SQLSelect("SELECT ID, TITLE, DESCRIPTION, LOCATION_ID FROM objects WHERE LOCATION_ID>0 ORDER BY TITLE");
        if (!is_array($objs)) $objs = array();
        $byLoc = array();
        foreach ($objs as $o) $byLoc[$o['LOCATION_ID']][] = $o;
        foreach ($locs as $loc) {
            if (empty($byLoc[$loc['ID']])) continue;
            $devices = array();
            foreach ($byLoc[$loc['ID']] as $o) {
                $name = $o['TITLE']; $controls = array();
                foreach ($this->AUTO_SWITCH_PROPS as $p) if ($this->hasValue(gg($name . '.' . $p))) $controls[] = array('prop' => $p, 'type' => 'switch');
                foreach ($this->AUTO_SENSOR_PROPS as $p) if ($this->hasValue(gg($name . '.' . $p))) $controls[] = array('prop' => $p, 'type' => 'sensor', 'readonly' => true);
                if (!count($controls)) continue;
                $title = ($o['DESCRIPTION'] !== null && $o['DESCRIPTION'] !== '') ? $o['DESCRIPTION'] : $name;
                $devices[] = array('id' => $name, 'title' => $title, 'icon' => $this->guessIcon($controls), 'controls' => $controls);
            }
            if (!count($devices)) continue;
            $rooms[] = array('id' => 'loc' . $loc['ID'], 'title' => $loc['TITLE'], 'devices' => $devices);
        }
        return $rooms;
    }

    private function hasValue($v) { return $v !== '' && $v !== null && $v !== false; }

    /* =====================================================================
     *  УСТАНОВКА
     * ===================================================================== */
    function install($parent_name = '')
    {
        $this->dbInstall();
        parent::install($parent_name);
    }

    function dbInstall($data = '')
    {
        $data = <<<EOD
 lovelace_config: ID int(10) unsigned NOT NULL auto_increment
 lovelace_config: USER_ID int(10) NOT NULL DEFAULT '0'
 lovelace_config: NAME varchar(64) NOT NULL DEFAULT 'default'
 lovelace_config: DATA mediumtext
 lovelace_config: PREFS text
 lovelace_config: UPDATED int(11) NOT NULL DEFAULT '0'
 lovelace_calendar: ID int(10) unsigned NOT NULL auto_increment
 lovelace_calendar: EVID varchar(32) NOT NULL DEFAULT ''
 lovelace_calendar: EDATE varchar(10) NOT NULL DEFAULT ''
 lovelace_calendar: ETIME varchar(8) NOT NULL DEFAULT ''
 lovelace_calendar: TITLE varchar(200) NOT NULL DEFAULT ''
 lovelace_calendar: NOTE text
 lovelace_calendar: COLOR varchar(8) NOT NULL DEFAULT ''
 lovelace_calendar: UPDATED int(11) NOT NULL DEFAULT '0'
 lovelace_tokens: ID int(10) unsigned NOT NULL auto_increment
 lovelace_tokens: TOKEN varchar(64) NOT NULL DEFAULT ''
 lovelace_tokens: TITLE varchar(100) NOT NULL DEFAULT ''
 lovelace_tokens: USER_ID int(10) NOT NULL DEFAULT '0'
 lovelace_tokens: CAN_CONTROL tinyint(1) NOT NULL DEFAULT '0'
 lovelace_tokens: CREATED int(11) NOT NULL DEFAULT '0'
 lovelace_tokens: LAST_SEEN int(11) NOT NULL DEFAULT '0'
 lovelace_devices: ID int(10) unsigned NOT NULL auto_increment
 lovelace_devices: TOKEN varchar(64) NOT NULL DEFAULT ''
 lovelace_devices: USER_ID int(10) NOT NULL DEFAULT '0'
 lovelace_devices: CREATED int(11) NOT NULL DEFAULT '0'
 lovelace_devices: EXPIRES int(11) NOT NULL DEFAULT '0'
 lovelace_devices: LAST_SEEN int(11) NOT NULL DEFAULT '0'
EOD;
        parent::dbInstall($data);
        // эмодзи в названиях: приводим таблицы к utf8mb4 (формат tbl:FIELD не задаёт charset)
        if (function_exists('SQLExec')) {
            @SQLExec("ALTER TABLE lovelace_config CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            @SQLExec("ALTER TABLE lovelace_calendar CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            @SQLExec("ALTER TABLE lovelace_tokens CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }
    }

    function uninstall() { parent::uninstall(); }
}
