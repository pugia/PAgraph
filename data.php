<?php

ini_set('display_errors', '0');
error_reporting(0);
	
$start = mktime(0,0,0,06,05,2015);

$days = 200;

echo '{"data":[<br/>';

for ($x = 0; $x < $days; $x++) {
	
	echo '{
	"label": "'.date('d M y', $start + ($x * 86400)).'",
	"value": '.rand(100,600).'
},<br/>';
	
}

echo ']
}';
