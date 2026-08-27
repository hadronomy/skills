#!/usr/bin/env perl
# Split cargo's carriage-return progress bar into discrete updates.
#
#   --state FILE   overwrite FILE with the newest progress line (no context cost)
#   --name  NAME   label written into FILE
#
# stdout carries terminal events only, so a caller running this under
# run_in_background pays one notification for the whole run.
use strict; use warnings;
$| = 1;

my ($state, $name) = ('', 'run');
while (@ARGV) {
    my $a = shift;
    $state = shift @ARGV if $a eq '--state';
    $name  = shift @ARGV if $a eq '--name';
}

sub publish {
    return unless $state;
    open(my $fh, '>', "$state.tmp") or return;   # write-then-rename: the status
    print $fh $_[0], "\n";                       # line never sees a half-written file
    close $fh;
    rename "$state.tmp", $state;
}

my $bars = 20;
while (my $chunk = <STDIN>) {
    for my $line (split /\r/, $chunk) {
        chomp $line;
        if ($line =~ m{Building \[[^\]]*\]\s+(\d+)/(\d+)(?::\s*(.*))?}) {
            my ($done, $total, $unit) = ($1, $2, $3 // '');
            next unless $total;
            my $pct = int($done * 100 / $total);
            $unit =~ s/[,(].*$//; $unit =~ s/\s+$//;
            my $filled = int($bars * $pct / 100);
            publish sprintf("%s\t%s%s %d%% %d/%d %s", $name,
                '#' x $filled, '.' x ($bars - $filled), $pct, $done, $total, $unit);
        }
        elsif ($line =~ /^\s*(Compiling|Checking|Downloading|Installing)\s+(\S+)/) {
            publish "$name\t$1 $2";
        }
        # Silence is not success: every terminal shape reaches stdout.
        elsif ($line =~ /^\s*(Finished|Running)\s/
            || $line =~ /^error(\[E\d+\])?[:\s]/
            || $line =~ /^\s*could not compile/
            || $line =~ /thread .* panicked/
            || $line =~ /linking with .* failed|Killed|out of memory|OOM|SIGKILL/) {
            $line =~ s/^\s+//;
            print "$line\n";
            publish "$name\t$line";
        }
    }
}
